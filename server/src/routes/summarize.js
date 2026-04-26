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

function normalizeToExpectedShape(raw) {
  const objectValue =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  const pickFirstString = (...values) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  };

  const toStringArray = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }
    return [];
  };

  return {
    summary: pickFirstString(
      objectValue.summary,
      objectValue.overview,
      objectValue.synopsis
    ),
    womenSections: toStringArray(
      objectValue.womenSections ?? objectValue.womenMentions ?? objectValue.sexDifferences
    ),
    biasNotes: toStringArray(
      objectValue.biasNotes ?? objectValue.biasFlags ?? objectValue.biases
    ),
    followUpQuestions: toStringArray(
      objectValue.followUpQuestions ??
        objectValue.followupQuestions ??
        objectValue.questions
    )
  };
}

function truncateArticleText(articleText) {
  if (articleText.length <= env.ANALYSIS_MAX_ARTICLE_CHARS) {
    return articleText;
  }
  return `${articleText.slice(0, env.ANALYSIS_MAX_ARTICLE_CHARS)}\n\n[Truncated for analysis length.]`;
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

  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(
      () => controller.abort(),
      env.ANALYSIS_TIMEOUT_MS
    );
    const llmResponse = await fetch(env.GEMMA_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(env.GEMMA_API_KEY
          ? { Authorization: `Bearer ${env.GEMMA_API_KEY}` }
          : {})
      },
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
      })
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

    const analysis = normalizeToExpectedShape(parseJsonFromText(content));

    const analysisSchema = z.object({
      summary: z.string().min(1),
      womenSections: z.array(z.string()),
      biasNotes: z.array(z.string()),
      followUpQuestions: z.array(z.string())
    });

    const validated = analysisSchema.safeParse(analysis);
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
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
});

export default router;
