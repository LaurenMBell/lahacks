import express from "express";
import { z } from "zod";
import { env } from "../config.js";

const router = express.Router();

const summarizeSchema = z.object({
  articleText: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  userProfile: z.record(z.any())
});

function compactUserProfile(userProfile) {
  const safeProfile =
    userProfile && typeof userProfile === "object" && !Array.isArray(userProfile)
      ? userProfile
      : {};
  return {
    ageRange: safeProfile.ageRange || null,
    sexAssignedAtBirth: safeProfile.sexAssignedAtBirth || null,
    gender: safeProfile.gender || null,
    conditions: safeProfile.conditions || null,
    medications: safeProfile.medications || null,
    goals: safeProfile.goals || null
  };
}

function buildPrompt({ title, url, userProfile, articleText }) {
  return `You are helping a women's health Chrome extension called WebMedica.

Article title: ${title}
URL: ${url}
User profile (JSON): ${JSON.stringify(compactUserProfile(userProfile))}

Article text:
${articleText}

Task:
1) Write a 2 sentence summary focused on women's health relevance.
2) List up to 4 explicit mentions of women/female/sex differences.
3) List up to 3 potential bias notes if present.
4) List exactly 3 concise follow-up questions for a doctor.

Return valid JSON only with the shape:
{ "summary": string, "womenSections": string[], "biasNotes": string[], "followUpQuestions": string[] }.`;
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

function truncateArticleText(articleText) {
  if (articleText.length <= env.ANALYSIS_MAX_ARTICLE_CHARS) {
    return articleText;
  }
  return `${articleText.slice(0, env.ANALYSIS_MAX_ARTICLE_CHARS)}\n\n[Truncated for analysis length.]`;
}

function toStringOrEmpty(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text.trim();
    }
    return JSON.stringify(value);
  }
  return String(value).trim();
}

function toStringArray(value) {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringOrEmpty(item))
      .filter((item) => item.length > 0);
  }
  const single = toStringOrEmpty(value);
  return single ? [single] : [];
}

router.post("/summarize-article", async (req, res) => {
  const parsed = summarizeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request payload.",
      details: parsed.error.flatten()
    });
  }

  const prompt = buildPrompt({
    ...parsed.data,
    articleText: truncateArticleText(parsed.data.articleText)
  });

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (env.GEMMA_API_KEY) {
      headers.Authorization = `Bearer ${env.GEMMA_API_KEY}`;
    }

    const llmResponse = await fetch(env.GEMMA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: env.GEMMA_MODEL,
        temperature: 0.1,
        max_tokens: env.ANALYSIS_MAX_TOKENS,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content:
              "You are a strict JSON generator. Return only valid JSON and no markdown."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: AbortSignal.timeout(env.ANALYSIS_TIMEOUT_MS)
    });

    if (!llmResponse.ok) {
      const errorBody = await llmResponse.text();
      return res.status(502).json({
        error: "LLM upstream request failed.",
        status: llmResponse.status,
        details: errorBody
      });
    }

    const llmJson = await llmResponse.json();
    const content = llmJson?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return res.status(502).json({
        error: "LLM returned an unexpected payload shape."
      });
    }

    const analysis = parseJsonFromText(content);
    const normalizedAnalysis = {
      summary: toStringOrEmpty(
        analysis?.summary ?? analysis?.overview ?? analysis?.synopsis
      ),
      womenSections: toStringArray(
        analysis?.womenSections ?? analysis?.womenMentions ?? analysis?.sexDifferences
      ),
      biasNotes: toStringArray(
        analysis?.biasNotes ?? analysis?.biasFlags ?? analysis?.biases
      ),
      followUpQuestions: toStringArray(
        analysis?.followUpQuestions ?? analysis?.followupQuestions ?? analysis?.questions
      )
    };

    const analysisSchema = z.object({
      summary: z.string().min(1),
      womenSections: z.array(z.string()),
      biasNotes: z.array(z.string()),
      followUpQuestions: z.array(z.string())
    });

    const validated = analysisSchema.safeParse(normalizedAnalysis);
    if (!validated.success) {
      return res.status(502).json({
        error: "LLM JSON did not match expected shape.",
        details: validated.error.flatten()
      });
    }

    return res.status(200).json(validated.data);
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Model request timed out.",
        timeoutMs: env.ANALYSIS_TIMEOUT_MS
      });
    }
    return res.status(500).json({
      error: "Failed to summarize article.",
      details: error.message
    });
  }
});

export default router;
