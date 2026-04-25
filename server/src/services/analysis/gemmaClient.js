import { env } from "../../config.js";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonFromText(text) {
  const candidate = `${text || ""}`.trim();
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  const extractedObject =
    objectStart >= 0 && objectEnd > objectStart
      ? candidate.slice(objectStart, objectEnd + 1)
      : candidate;

  const normalized = extractedObject
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();

  const attempts = [candidate, extractedObject, normalized];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try next strategy.
    }
  }

  // Final salvage attempt for truncated JSON objects.
  const balanced = tryBalanceJsonObject(normalized);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      // Ignore; fall through to explicit error.
    }
  }

  throw new Error("Model output was not valid JSON.");
}

function tryBalanceJsonObject(input) {
  if (!input || !input.includes("{")) {
    return null;
  }

  const stack = [];
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" && stack[stack.length - 1] === "{") {
      stack.pop();
      continue;
    }

    if (char === "]" && stack[stack.length - 1] === "[") {
      stack.pop();
    }
  }

  let suffix = "";
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    suffix += stack[index] === "{" ? "}" : "]";
  }

  return `${input}${suffix}`;
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId)
  };
}

function normalizeApiUrl(apiUrl) {
  return `${apiUrl || ""}`.trim().replace(/\/+$/, "");
}

function isLocalOllamaUrl(apiUrl) {
  return /(^https?:\/\/)?(localhost|127\.0\.0\.1):11434$/i.test(apiUrl || "");
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

  const prefersOllama = isLocalOllamaUrl(normalized) || /ollama/i.test(normalized);

  if (prefersOllama) {
    // Local Ollama should not pay latency for OpenAI-compatible fallback endpoints.
    if (isLocalOllamaUrl(normalized)) {
      return [{ url: `${normalized}/api/chat`, mode: "ollama" }];
    }

    return [
      { url: `${normalized}/api/chat`, mode: "ollama" },
      { url: `${normalized}/v1/chat/completions`, mode: "openai" }
    ];
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
    // Extra retries often double perceived latency; keep requests single-shot by default.
    this.maxRequestRetries = 0;
  }

  assertConfigured() {
    if (!this.apiUrl) {
      throw new Error("Server is missing GEMMA_API_URL.");
    }
  }

  async requestCompletion({ messages }) {
    this.assertConfigured();
    const endpointCandidates = resolveEndpointCandidates(this.apiUrl);
    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRequestRetries; attempt += 1) {
      try {
        let lastNonRetryableError = null;

        for (const endpoint of endpointCandidates) {
          const headers = {
            "Content-Type": "application/json"
          };
          if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
          }

          const { signal, cancel } = createTimeoutSignal(this.timeoutMs);
          let response;
          try {
            response = await fetch(endpoint.url, {
              method: "POST",
              headers,
              signal,
              body: JSON.stringify(
                buildRequestBody({
                  mode: endpoint.mode,
                  model: this.model,
                  messages
                })
              )
            });
          } finally {
            cancel();
          }

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
          lastError = lastNonRetryableError;
          throw lastNonRetryableError;
        }
        const error = new Error("Gemma request failed across all configured endpoints.");
        lastError = error;
        throw error;
      } catch (error) {
        const errorMessage = error?.message || `${error || ""}`;
        const didTimeout =
          error?.name === "AbortError" ||
          /timed?\s*out|aborted/i.test(errorMessage);
        const message = didTimeout
          ? `Gemma request timed out after ${this.timeoutMs}ms.`
          : errorMessage || "Gemma request failed.";
        lastError = new Error(message);

        if (attempt < this.maxRequestRetries && didTimeout) {
          await delay(350 * (attempt + 1));
          continue;
        }

        throw new Error(message);
      }
    }

    throw lastError || new Error("Gemma request failed.");
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

    // If JSON parses but schema still mismatches, a repair pass is usually slow and low-yield.
    if ((firstResult.error || "").includes("did not match expected shape")) {
      throw new Error(firstResult.error);
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
