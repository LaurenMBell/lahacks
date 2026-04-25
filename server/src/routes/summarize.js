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

function buildPrompt({ title, url, userProfile, articleText }) {
  return `You are helping a women's health Chrome extension called Woman WebMD.

Article title: ${title}
URL: ${url}
User profile (JSON): ${JSON.stringify(userProfile)}

Article text:
${articleText}

Briefly describe what this study focuses on, in 2-3 sentences, focusing on women's health.
Identify explicit mentions of women/female/sex differences.
Flag any signs of bias (for example, more male than female subjects) if present.
Generate 3-5 follow-up questions this user might ask their doctor.

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

router.post("/summarize-article", async (req, res) => {
  const parsed = summarizeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request payload.",
      details: parsed.error.flatten()
    });
  }

  if (!env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Server is missing OPENAI_API_KEY."
    });
  }

  const prompt = buildPrompt(parsed.data);

  try {
    const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.2,
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

    const analysis = parseJsonFromText(content);

    const analysisSchema = z.object({
      summary: z.string(),
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
    return res.status(500).json({
      error: "Failed to summarize article.",
      details: error.message
    });
  }
});

export default router;
