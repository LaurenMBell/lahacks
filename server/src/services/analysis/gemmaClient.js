import { env } from "../../config.js";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonFromText(text) {
  const candidate = text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }

    throw new Error("Model output was not valid JSON.");
  }
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId)
  };
}

function normalizeApiUrl(apiUrl) {
  return `${apiUrl || ""}`.trim().replace(/\/+$/, "");
}

function resolveEndpointCandidates(apiUrl) {
  const normalized = normalizeApiUrl(apiUrl);
  if (!normalized) {
    return [];
  }

  if (normalized.endsWith("/v1/chat/completions")) {
    return [{ url: normalized, mode: "openai" }];
  }

  if (normalized.endsWith("/api/chat")) {
    return [{ url: normalized, mode: "ollama" }];
  }

  return [
    { url: `${normalized}/v1/chat/completions`, mode: "openai" },
    { url: `${normalized}/api/chat`, mode: "ollama" }
  ];
}

function parseContentFromPayload(payload, mode) {
  if (mode === "openai") {
    return payload?.choices?.[0]?.message?.content;
  }

  return payload?.message?.content;
}

function buildRequestBody({ mode, model, messages }) {
  if (mode === "openai") {
    return {
      model,
      temperature: 0.2,
      messages
    };
  }

  return {
    model,
    messages,
    stream: false,
    format: "json",
    options: {
      temperature: 0.2
    }
  };
}

export class GemmaClient {
  constructor(config = env) {
    this.apiUrl = config.GEMMA_API_URL;
    this.apiKey = config.GEMMA_API_KEY;
    this.model = config.GEMMA_MODEL;
    this.timeoutMs = config.ANALYSIS_TIMEOUT_MS;
    this.maxRequestRetries = 1;
  }

  assertConfigured() {
    if (!this.apiUrl) {
      throw new Error("Server is missing GEMMA_API_URL.");
    }

    if (!this.apiKey) {
      throw new Error("Server is missing GEMMA_API_KEY.");
    }
  }

  async requestCompletion({ messages }) {
    this.assertConfigured();
    const endpointCandidates = resolveEndpointCandidates(this.apiUrl);
    for (let attempt = 0; attempt <= this.maxRequestRetries; attempt += 1) {
      const { signal, cancel } = createTimeoutSignal(this.timeoutMs);

      try {
        let lastNonRetryableError = null;

        for (const endpoint of endpointCandidates) {
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            signal,
            body: JSON.stringify(
              buildRequestBody({
                mode: endpoint.mode,
                model: this.model,
                messages
              })
            )
          });

          if (!response.ok) {
            const details = await response.text();
            const message = `Gemma upstream request failed (${response.status}) at ${endpoint.url}: ${details}`;

            if (attempt < this.maxRequestRetries && TRANSIENT_STATUS_CODES.has(response.status)) {
              await delay(350 * (attempt + 1));
              continue;
            }

            lastNonRetryableError = new Error(message);
            continue;
          }

          const payload = await response.json();
          const content = parseContentFromPayload(payload, endpoint.mode);

          if (typeof content !== "string" || !content.trim()) {
            lastNonRetryableError = new Error(
              `Gemma returned an unexpected payload shape from ${endpoint.url}.`
            );
            continue;
          }

          return {
            content,
            rawResponse: JSON.stringify(payload)
          };
        }

        if (lastNonRetryableError) {
          throw lastNonRetryableError;
        }
        throw new Error("Gemma request failed across all configured endpoints.");
      } catch (error) {
        const didTimeout = error?.name === "AbortError";
        const message = didTimeout
          ? `Gemma request timed out after ${this.timeoutMs}ms.`
          : error.message || "Gemma request failed.";

        if (attempt < this.maxRequestRetries && didTimeout) {
          await delay(350 * (attempt + 1));
          continue;
        }

        throw new Error(message);
      } finally {
        cancel();
      }
    }

    throw new Error("Gemma request failed.");
  }

  async createJsonCompletion({
    systemPrompt,
    userPrompt,
    repairPrompt,
    schema
  }) {
    const firstAttempt = await this.requestCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const firstResult = this.tryValidate(firstAttempt.content, schema);
    if (firstResult.success) {
      return {
        data: firstResult.data,
        content: firstAttempt.content,
        rawResponse: firstAttempt.rawResponse,
        repaired: false
      };
    }

    const secondAttempt = await this.requestCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { role: "assistant", content: firstAttempt.content },
        { role: "user", content: repairPrompt }
      ]
    });

    const secondResult = this.tryValidate(secondAttempt.content, schema);
    if (!secondResult.success) {
      throw new Error(secondResult.error);
    }

    return {
      data: secondResult.data,
      content: secondAttempt.content,
      rawResponse: secondAttempt.rawResponse,
      repaired: true
    };
  }

  tryValidate(content, schema) {
    try {
      const parsed = parseJsonFromText(content);
      const validated = schema.safeParse(parsed);

      if (!validated.success) {
        return {
          success: false,
          error: `Gemma JSON did not match expected shape: ${validated.error.message}`
        };
      }

      return {
        success: true,
        data: validated.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Could not parse Gemma JSON output."
      };
    }
  }

  async checkHealth() {
    this.assertConfigured();

    const completion = await this.requestCompletion({
      messages: [
        { role: "system", content: "You are a health check endpoint. Reply with the single word ok." },
        { role: "user", content: "ok" }
      ]
    });

    return {
      ok: true,
      model: this.model,
      sample: completion.content.slice(0, 40)
    };
  }
}

export const gemmaClient = new GemmaClient();
