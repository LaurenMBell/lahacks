import { Router } from "express";
import { prisma } from "../prisma.js";
import { articleSnapshotSchema, userProfileSchema } from "../services/analysis/contracts.js";

const router = Router();

const createArticleSessionSchema = articleSnapshotSchema.extend({
  userProfile: userProfileSchema.optional()
});

router.post("/session", async (req, res) => {
  const parsed = createArticleSessionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid article session payload.",
      details: parsed.error.flatten()
    });
  }

  const data = parsed.data;

  try {
    const session = await prisma.articleSession.create({
      data: {
        url: data.url,
        normalizedUrl: data.normalizedUrl,
        title: data.title,
        sourceHost: data.sourceHost ?? null,
        pageType: data.pageType ?? null,
        rawText: data.rawText,
        abstractText: data.abstractText ?? null,
        authors: data.authors,
        journal: data.journal ?? null,
        publishedAtLabel: data.publishedAtLabel ?? null,
        pmid: data.pmid ?? null,
        doi: data.doi ?? null,
        headings: data.headings,
        extractionPayload: {
          ...data.extractionPayload,
          rawExtractedInput: data
        },
        userProfileSnapshot: data.userProfile ?? null,
        status: "pending"
      }
    });

    return res.status(201).json({
      articleSession: {
        id: session.id,
        status: session.status,
        title: session.title,
        url: session.url
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create article session.",
      details: error.message
    });
  }
});

router.get("/recent", async (_req, res) => {
  try {
    const sessions = await prisma.articleSession.findMany({
      orderBy: { lastViewedAt: "desc" },
      take: 10,
      include: {
        insights: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return res.status(200).json({
      articles: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        url: session.url,
        sourceHost: session.sourceHost,
        status: session.status,
        lastViewedAt: session.lastViewedAt,
        summary: session.insights[0]?.summary ?? null
      }))
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch recent article sessions.",
      details: error.message
    });
  }
});

export default router;
