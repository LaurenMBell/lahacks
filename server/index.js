import "dotenv/config";
import cors from "cors";
import express from "express";
import fetch from "node-fetch";

const app = express();
const LANGUAGE_MODES = ["plain", "clinical", "doctorPrep"];

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          // Handle model outputs like { point: "..."} or { text: "..."}.
          const candidate =
            item.point || item.text || item.note || item.summary || item.title;
          if (candidate && typeof candidate === "string") return candidate.trim();
          return JSON.stringify(item);
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeAnalysis(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  return {
    summary:
      typeof safe.summary === "string" && safe.summary.trim()
        ? safe.summary.trim()
        : "No summary available.",
    womenSections: toStringArray(safe.womenSections),
    biasNotes: toStringArray(safe.biasNotes),
    followUpQuestions: toStringArray(safe.followUpQuestions)
  };
}

function parseBestEffortFromText(text) {
  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/i);
  const womenMatch = text.match(/"womenSections"\s*:\s*\[([\s\S]*?)\]/i);
  const biasMatch = text.match(/"biasNotes"\s*:\s*\[([\s\S]*?)\]/i);
  const followUpMatch = text.match(/"followUpQuestions"\s*:\s*\[([\s\S]*?)\]/i);

  const extractQuotedItems = (value) => {
    if (!value) return [];
    const matches = value.match(/"([^"]+)"/g);
    if (!matches) return [];
    return matches.map((item) => item.replaceAll('"', "").trim()).filter(Boolean);
  };

  return normalizeAnalysis({
    summary: summaryMatch?.[1] || "Summary unavailable from model output.",
    womenSections: extractQuotedItems(womenMatch?.[1]),
    biasNotes: extractQuotedItems(biasMatch?.[1]),
    followUpQuestions: extractQuotedItems(followUpMatch?.[1])
  });
}

app.use(cors());
app.use(express.json());

app.post("/profile/send-update-email", async (req, res) => {
  try {
    const { email, fullName } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Email provider not configured."
      });
    }

    const recipientName =
      typeof fullName === "string" && fullName.trim() ? fullName.trim() : "there";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: "Your Woman WebMD profile was updated",
        html: `
          <p>Hi ${recipientName},</p>
          <p>Your Woman WebMD profile was successfully updated.</p>
          <p>If this wasn't you, please update your profile again or contact support.</p>
        `
      })
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      console.error("Email send failed:", details);
      return res.status(502).json({ error: "Email provider request failed." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("send-update-email error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/summarize-article", async (req, res) => {
  try {
    const { articleText, title, url, userProfile, languageMode } = req.body;

    if (!articleText || !title) {
      return res.status(400).json({ error: "Missing articleText or title" });
    }

    const selectedMode = LANGUAGE_MODES.includes(languageMode)
      ? languageMode
      : "plain";

    const modeInstructionById = {
      plain:
        "Use plain-language wording suitable for a general audience. Prefer short sentences and define medical terms briefly.",
      clinical:
        "Use concise clinical language with medically precise terminology. Keep wording objective and evidence-oriented.",
      doctorPrep:
        "Use patient coaching language focused on preparing for a doctor's visit. Highlight what to ask, monitor, and clarify."
    };

    const prompt = `
You are an assistant for a women's health Chrome extension called Woman WebMD.

Article title: ${title}
URL: ${url}
User profile (JSON): ${JSON.stringify(userProfile, null, 2)}
Language mode: ${selectedMode}

Article text:
${articleText}

Style requirement:
${modeInstructionById[selectedMode]}

Tasks:
1) Briefly describe what this study focuses on, in 2-3 sentences, focusing on women's health.
2) Identify explicit mentions of women/female/sex differences and explain what they say in plain language.
3) Write "what this means for women" as practical takeaways tailored to this user's profile. Include risks, relevance, and any caveats.
4) Generate 2-5 bias notes. Specifically check for:
   - underrepresentation or exclusion of women
   - missing sex-disaggregated results
   - confounders not discussed (age, race/ethnicity, pregnancy status, menopause status)
   - sample source limitations (single clinic/region)
   - over-generalized claims
   If evidence is missing, explicitly say uncertainty.
5) Generate 3-5 follow-up questions this user might ask their doctor.

Critical output rules:
- womenSections MUST be an array of plain strings, not objects.
- biasNotes MUST be an array of plain strings, not objects.
- Each womenSections item should start with an action-oriented phrase such as:
  "For women with...", "This may matter if...", "Ask your doctor about..."
- If the article is not women-specific, still provide 2-4 practical women-focused takeaways and mention uncertainty clearly.
- If bias evidence is weak, include at least one bias note that states uncertainty explicitly.
- Keep each item concise (1 sentence).
- Do not return markdown.

Return ONLY valid JSON with this exact shape:
{
  "summary": string,
  "womenSections": string[],
  "biasNotes": string[],
  "followUpQuestions": string[]
}
`;

    const ollamaRes = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma:2b",
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0
        }
      })
    });

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      console.error("Ollama error:", text);
      return res.status(500).json({ error: "Ollama request failed" });
    }

    const ollamaJson = await ollamaRes.json();
    const rawOutput = ollamaJson.response || "";

    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (error) {
      // Fallback for models that still emit extra prose around JSON.
      const start = rawOutput.indexOf("{");
      const end = rawOutput.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(rawOutput.slice(start, end + 1));
        } catch (innerError) {
          console.error(
            "Failed to parse JSON from Gemma:",
            innerError,
            rawOutput
          );
          return res.json(parseBestEffortFromText(rawOutput));
        }
      } else {
        console.error("Failed to parse JSON from Gemma:", error, rawOutput);
        return res.json(parseBestEffortFromText(rawOutput));
      }
    }

    return res.json(normalizeAnalysis(parsed));
  } catch (error) {
    console.error("summarize-article error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Gemma server listening on port ${PORT}`);
});
