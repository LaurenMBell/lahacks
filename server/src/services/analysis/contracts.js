import { z } from "zod";

const nullableArrayDefault = (itemSchema) =>
  z.preprocess((value) => {
    if (value == null) {
      return [];
    }
    return Array.isArray(value) ? value : [];
  }, z.array(itemSchema).default([]));

const flexibleStringArray = z.preprocess((value) => {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      return [trimmed];
    }
  }

  if (trimmed.includes("\n")) {
    return trimmed
      .split("\n")
      .map((item) => item.replace(/^[\s\-*•]+/, "").trim())
      .filter(Boolean);
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [trimmed];
}, z.array(z.string().min(1)).default([]));

const relevanceScoreSchema = z.preprocess((value) => {
  if (value == null || value === "") {
    return null;
  }

  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(`${value}`.replace("%", "").trim());

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric > 1 && numeric <= 100) {
    return numeric / 100;
  }

  return numeric;
}, z.number().min(0).max(1).nullable().optional());

export const citationSchema = z.object({
  label: z.string().min(1),
  quote: z.string().min(1),
  source_section: z.string().optional().nullable(),
  anchor_text: z.string().optional().nullable(),
  explanation: z.string().optional().nullable()
});

export const tagSchema = z.object({
  label: z.string().min(1),
  value: z.string().optional().nullable(),
  category: z.string().min(1),
  anchor_text: z.string().optional().nullable()
});

export const articleAnalysisSchema = z.object({
  summary: z.string().min(1),
  user_specific_notes: flexibleStringArray,
  citations: nullableArrayDefault(citationSchema),
  tags: nullableArrayDefault(tagSchema),
  follow_up_suggestions: flexibleStringArray,
  related_article_keywords: flexibleStringArray,
  relevance_score: relevanceScoreSchema,
  warnings: flexibleStringArray
});

export const followUpAnalysisSchema = z.object({
  answer: z.string().min(1),
  citations: nullableArrayDefault(citationSchema),
  warnings: nullableArrayDefault(z.string().min(1))
});

export const keywordGenerationSchema = z.object({
  related_article_keywords: nullableArrayDefault(z.string().min(1)),
  rationale: z.string().min(1)
});

export const articleSnapshotSchema = z.object({
  url: z.string().url(),
  normalizedUrl: z.string().url(),
  title: z.string().min(1),
  sourceHost: z.string().min(1).optional().nullable(),
  pageType: z.string().min(1).optional().nullable(),
  rawText: z.string().min(1),
  abstractText: z.string().optional().nullable(),
  authors: z.array(z.string().min(1)).default([]),
  journal: z.string().optional().nullable(),
  publishedAtLabel: z.string().optional().nullable(),
  pmid: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  headings: z.array(z.string().min(1)).default([]),
  sectionLabels: z.array(z.string().min(1)).default([]),
  extractionPayload: z.record(z.any()).optional()
});

export const userProfileSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().optional(),
  ageRange: z.string().optional(),
  weight: z.string().optional(),
  sexAssignedAtBirth: z.string().optional(),
  gender: z.string().optional(),
  familyMedicalHistory: z.string().optional(),
  substanceUse: z.array(z.string()).optional(),
  substanceUseOther: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  dietaryRestrictionsOther: z.string().optional(),
  conditions: z.string().optional(),
  medications: z.string().optional(),
  goals: z.string().optional()
});

export const runAnalysisRequestSchema = z.object({
  articleSessionId: z.string().min(1),
  userProfile: userProfileSchema
});

export const followUpRequestSchema = z.object({
  question: z.string().min(1),
  userProfile: userProfileSchema.optional()
});
