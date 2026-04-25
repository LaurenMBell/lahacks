import { prisma } from "../../prisma.js";
import {
  articleAnalysisSchema,
  followUpAnalysisSchema,
  keywordGenerationSchema
} from "./contracts.js";
import { gemmaClient } from "./gemmaClient.js";
import {
  ANALYSIS_SYSTEM_PROMPT,
  GEMMA_PROMPT_VERSION,
  buildArticleAnalysisPrompt,
  buildFollowUpPrompt,
  buildKeywordPrompt,
  buildRepairPrompt
} from "./prompts.js";

export const GEMMA_TASK_TYPES = {
  ARTICLE_ANALYSIS: "article_analysis",
  FOLLOW_UP: "follow_up_qa",
  KEYWORD_GENERATION: "keyword_generation"
};

function serializeInsight(insight, citations = [], tags = []) {
  if (!insight) {
    return null;
  }

  return {
    id: insight.id,
    summary: insight.summary,
    user_specific_notes: insight.userSpecificNotes,
    citations: citations.map((item) => ({
      label: item.label,
      quote: item.quote,
      source_section: item.sourceSection,
      anchor_text: item.anchorText,
      explanation: item.explanation
    })),
    tags: tags.map((item) => ({
      label: item.label,
      value: item.value,
      category: item.category,
      anchor_text: item.anchorText
    })),
    follow_up_suggestions: insight.followUpSuggestions,
    related_article_keywords: insight.relatedArticleKeywords,
    relevance_score: insight.relevanceScore,
    warnings: insight.warnings,
    model_name: insight.modelName,
    prompt_version: insight.promptVersion,
    created_at: insight.createdAt
  };
}

async function upsertJob(articleSessionId, jobType, updater) {
  const existing = await prisma.analysisJob.findFirst({
    where: { articleSessionId, jobType },
    orderBy: { createdAt: "desc" }
  });

  if (!existing) {
    return prisma.analysisJob.create({
      data: {
        articleSessionId,
        jobType,
        ...updater(null)
      }
    });
  }

  return prisma.analysisJob.update({
    where: { id: existing.id },
    data: updater(existing)
  });
}

export async function runArticleAnalysis({ articleSessionId, userProfile }) {
  const articleSession = await prisma.articleSession.findUnique({
    where: { id: articleSessionId }
  });

  if (!articleSession) {
    throw new Error("Article session not found.");
  }

  await prisma.articleSession.update({
    where: { id: articleSessionId },
    data: {
      status: "analyzing",
      userProfileSnapshot: userProfile
    }
  });

  await upsertJob(articleSessionId, GEMMA_TASK_TYPES.ARTICLE_ANALYSIS, (existing) => ({
    status: "running",
    attemptCount: (existing?.attemptCount || 0) + 1,
    lastError: null
  }));

  try {
    const prompt = buildArticleAnalysisPrompt({ articleSession, userProfile });
    const repairPrompt = buildRepairPrompt("Return the requested article-analysis JSON shape.");
    const completion = await gemmaClient.createJsonCompletion({
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      userPrompt: prompt,
      repairPrompt,
      schema: articleAnalysisSchema
    });

    const result = completion.data;
    const now = new Date();
    const insightData = {
      articleSessionId,
      summary: result.summary,
      userSpecificNotes: result.user_specific_notes,
      followUpSuggestions: result.follow_up_suggestions,
      relatedArticleKeywords: result.related_article_keywords,
      warnings: result.warnings,
      relevanceScore: result.relevance_score ?? null,
      modelName: gemmaClient.model,
      promptVersion: GEMMA_PROMPT_VERSION,
      rawModelResponse: completion.rawResponse
    };

    const persisted = await prisma.$transaction(async (tx) => {
      const createdInsight = await tx.articleInsight.create({
        data: insightData
      });

      await tx.articleCitation.deleteMany({
        where: { articleSessionId }
      });
      await tx.articleTag.deleteMany({
        where: { articleSessionId }
      });

      if (result.citations.length > 0) {
        await tx.articleCitation.createMany({
          data: result.citations.map((item, index) => ({
            articleSessionId,
            label: item.label,
            quote: item.quote,
            sourceSection: item.source_section ?? null,
            anchorText: item.anchor_text ?? null,
            explanation: item.explanation ?? null,
            orderIndex: index
          }))
        });
      }

      if (result.tags.length > 0) {
        await tx.articleTag.createMany({
          data: result.tags.map((item, index) => ({
            articleSessionId,
            label: item.label,
            value: item.value ?? null,
            category: item.category,
            anchorText: item.anchor_text ?? null,
            orderIndex: index
          }))
        });
      }

      await tx.articleSession.update({
        where: { id: articleSessionId },
        data: {
          status: "complete",
          completedAt: now,
          lastViewedAt: now
        }
      });
      await tx.analysisJob.updateMany({
        where: { articleSessionId, jobType: GEMMA_TASK_TYPES.ARTICLE_ANALYSIS },
        data: { status: "complete", lastError: null }
      });

      return createdInsight;
    });

    // Return immediately from in-memory result rather than re-querying.
    return serializeInsight(
      persisted,
      result.citations.map((item) => ({
        label: item.label,
        quote: item.quote,
        sourceSection: item.source_section ?? null,
        anchorText: item.anchor_text ?? null,
        explanation: item.explanation ?? null
      })),
      result.tags.map((item) => ({
        label: item.label,
        value: item.value ?? null,
        category: item.category,
        anchorText: item.anchor_text ?? null
      }))
    );
  } catch (error) {
    await prisma.$transaction([
      prisma.articleSession.update({
        where: { id: articleSessionId },
        data: { status: "failed" }
      }),
      prisma.analysisJob.updateMany({
        where: { articleSessionId, jobType: GEMMA_TASK_TYPES.ARTICLE_ANALYSIS },
        data: { status: "failed", lastError: error.message || "Analysis failed." }
      })
    ]);

    throw error;
  }
}

export async function getLatestAnalysis(articleSessionId) {
  const articleSession = await prisma.articleSession.findUnique({
    where: { id: articleSessionId },
    include: {
      insights: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      citations: {
        orderBy: { orderIndex: "asc" }
      },
      tags: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!articleSession) {
    return null;
  }

  return {
    articleSession: {
      id: articleSession.id,
      title: articleSession.title,
      url: articleSession.url,
      status: articleSession.status,
      sourceHost: articleSession.sourceHost,
      journal: articleSession.journal,
      publishedAtLabel: articleSession.publishedAtLabel,
      doi: articleSession.doi,
      pmid: articleSession.pmid
    },
    analysis: serializeInsight(
      articleSession.insights[0] ?? null,
      articleSession.citations,
      articleSession.tags
    )
  };
}

export async function answerFollowUpQuestion({
  articleSessionId,
  question,
  userProfile
}) {
  const articleSession = await prisma.articleSession.findUnique({
    where: { id: articleSessionId },
    include: {
      insights: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      citations: {
        orderBy: { orderIndex: "asc" }
      },
      tags: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!articleSession) {
    throw new Error("Article session not found.");
  }

  await upsertJob(articleSessionId, GEMMA_TASK_TYPES.FOLLOW_UP, (existing) => ({
    status: "running",
    attemptCount: (existing?.attemptCount || 0) + 1,
    lastError: null
  }));

  const priorAnalysis = serializeInsight(
    articleSession.insights[0] ?? null,
    articleSession.citations,
    articleSession.tags
  );

  const prompt = buildFollowUpPrompt({
    articleSession,
    userProfile: userProfile || articleSession.userProfileSnapshot || {},
    priorAnalysis,
    question
  });

  try {
    const completion = await gemmaClient.createJsonCompletion({
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      userPrompt: prompt,
      repairPrompt: buildRepairPrompt("Return the requested follow-up JSON shape."),
      schema: followUpAnalysisSchema
    });

    const record = await prisma.followUpQuestion.create({
      data: {
        articleSessionId,
        question,
        answer: completion.data.answer,
        status: "complete",
        rawModelResponse: completion.rawResponse
      }
    });

    await prisma.analysisJob.updateMany({
      where: { articleSessionId, jobType: GEMMA_TASK_TYPES.FOLLOW_UP },
      data: { status: "complete", lastError: null }
    });

    return {
      id: record.id,
      question: record.question,
      answer: record.answer,
      citations: completion.data.citations,
      warnings: completion.data.warnings
    };
  } catch (error) {
    await prisma.analysisJob.updateMany({
      where: { articleSessionId, jobType: GEMMA_TASK_TYPES.FOLLOW_UP },
      data: { status: "failed", lastError: error.message || "Follow-up failed." }
    });
    throw error;
  }
}

export async function generateRelatedKeywords(articleSessionId) {
  const articleSession = await prisma.articleSession.findUnique({
    where: { id: articleSessionId },
    include: {
      insights: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      citations: {
        orderBy: { orderIndex: "asc" }
      },
      tags: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!articleSession) {
    throw new Error("Article session not found.");
  }

  await upsertJob(articleSessionId, GEMMA_TASK_TYPES.KEYWORD_GENERATION, (existing) => ({
    status: "running",
    attemptCount: (existing?.attemptCount || 0) + 1,
    lastError: null
  }));

  const priorAnalysis = serializeInsight(
    articleSession.insights[0] ?? null,
    articleSession.citations,
    articleSession.tags
  );

  try {
    const completion = await gemmaClient.createJsonCompletion({
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      userPrompt: buildKeywordPrompt({ articleSession, priorAnalysis }),
      repairPrompt: buildRepairPrompt("Return the requested keyword-generation JSON shape."),
      schema: keywordGenerationSchema
    });

    await prisma.analysisJob.updateMany({
      where: { articleSessionId, jobType: GEMMA_TASK_TYPES.KEYWORD_GENERATION },
      data: { status: "complete", lastError: null }
    });

    return completion.data;
  } catch (error) {
    await prisma.analysisJob.updateMany({
      where: { articleSessionId, jobType: GEMMA_TASK_TYPES.KEYWORD_GENERATION },
      data: { status: "failed", lastError: error.message || "Keyword generation failed." }
    });
    throw error;
  }
}
