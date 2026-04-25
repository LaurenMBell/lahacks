import { Router } from "express";
import {
  followUpRequestSchema,
  runAnalysisRequestSchema
} from "../services/analysis/contracts.js";
import {
  answerFollowUpQuestion,
  generateRelatedKeywords,
  getLatestAnalysis,
  runArticleAnalysis
} from "../services/analysis/analysisService.js";

const router = Router();

router.post("/run", async (req, res) => {
  const parsed = runAnalysisRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid analysis payload.",
      details: parsed.error.flatten()
    });
  }

  try {
    const analysis = await runArticleAnalysis(parsed.data);

    return res.status(200).json({
      status: "complete",
      analysis
    });
  } catch (error) {
    const isTimeout = (error.message || "").toLowerCase().includes("timed out");
    return res.status(isTimeout ? 504 : 500).json({
      error: "Failed to run analysis.",
      status: "failed",
      details: error.message
    });
  }
});

router.get("/:articleSessionId", async (req, res) => {
  const result = await getLatestAnalysis(req.params.articleSessionId);

  if (!result) {
    return res.status(404).json({
      error: "Article analysis not found."
    });
  }

  return res.status(200).json(result);
});

router.post("/:articleSessionId/follow-up", async (req, res) => {
  const parsed = followUpRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid follow-up payload.",
      details: parsed.error.flatten()
    });
  }

  try {
    const result = await answerFollowUpQuestion({
      articleSessionId: req.params.articleSessionId,
      ...parsed.data
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to answer follow-up question.",
      details: error.message
    });
  }
});

router.post("/:articleSessionId/keywords", async (req, res) => {
  try {
    const result = await generateRelatedKeywords(req.params.articleSessionId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to generate related article keywords.",
      details: error.message
    });
  }
});

export default router;
