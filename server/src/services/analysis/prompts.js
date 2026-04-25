export const GEMMA_PROMPT_VERSION = "gemma-v1";

export const ANALYSIS_SYSTEM_PROMPT = `
You are Luma, a health-information interpreter inside a browser sidebar.
Your job is to interpret article text for a specific user profile.

Rules:
- Use only the article content provided to support citations and evidence claims.
- Do not diagnose, prescribe treatment, or imply clinical certainty.
- Explain uncertainty and limitations when evidence is weak, incomplete, or not specific to the user.
- Tailor interpretation to the user profile conservatively.
- Keep suggestions for related topics and follow-up questions grounded in the article.
- Return valid JSON only. Do not wrap the JSON in markdown.
`.trim();

function formatUserProfile(userProfile) {
  const entries = Object.entries(userProfile || {}).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== undefined && value !== null && `${value}`.trim() !== "";
  });

  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

function formatArticle(articleSession) {
  return JSON.stringify(
    {
      title: articleSession.title,
      url: articleSession.url,
      sourceHost: articleSession.sourceHost,
      journal: articleSession.journal,
      publishedAtLabel: articleSession.publishedAtLabel,
      pmid: articleSession.pmid,
      doi: articleSession.doi,
      abstractText: articleSession.abstractText,
      headings: articleSession.headings,
      sectionLabels: articleSession.extractionPayload?.sectionLabels || [],
      rawText: articleSession.rawText
    },
    null,
    2
  );
}

export function buildArticleAnalysisPrompt({ articleSession, userProfile }) {
  return `
Analyze this article for the given user profile.

User profile:
${formatUserProfile(userProfile)}

Article:
${formatArticle(articleSession)}

Return JSON with exactly this shape:
{
  "summary": string,
  "user_specific_notes": string[],
  "citations": [
    {
      "label": string,
      "quote": string,
      "source_section": string | null,
      "anchor_text": string | null,
      "explanation": string | null
    }
  ],
  "tags": [
    {
      "label": string,
      "value": string | null,
      "category": string,
      "anchor_text": string | null
    }
  ],
  "follow_up_suggestions": string[],
  "related_article_keywords": string[],
  "relevance_score": number | null,
  "warnings": string[]
}

Tag categories should use values like:
- "study_population"
- "condition_relevance"
- "medication_relevance"
- "age_relevance"
- "sex_relevance"
- "evidence_strength"

Direct citations must quote text from the article only.
Keep the summary concise.
`.trim();
}

export function buildFollowUpPrompt({
  articleSession,
  userProfile,
  priorAnalysis,
  question
}) {
  return `
Answer the user's follow-up question using the article and prior analysis.

User profile:
${formatUserProfile(userProfile)}

Prior analysis:
${JSON.stringify(priorAnalysis, null, 2)}

Article:
${formatArticle(articleSession)}

User question:
${question}

Return JSON with exactly this shape:
{
  "answer": string,
  "citations": [
    {
      "label": string,
      "quote": string,
      "source_section": string | null,
      "anchor_text": string | null,
      "explanation": string | null
    }
  ],
  "warnings": string[]
}
`.trim();
}

export function buildKeywordPrompt({ articleSession, priorAnalysis }) {
  return `
Generate conservative PubMed search keywords based on the article and prior analysis.

Prior analysis:
${JSON.stringify(priorAnalysis, null, 2)}

Article:
${formatArticle(articleSession)}

Return JSON with exactly this shape:
{
  "related_article_keywords": string[],
  "rationale": string
}
`.trim();
}

export function buildRepairPrompt(rawContent) {
  return `
The previous response was invalid. Repair it and return valid JSON only.

Previous response:
${rawContent}
`.trim();
}
