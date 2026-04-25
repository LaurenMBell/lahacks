import cors from "cors";
import express from "express";
import { env } from "./config.js";
import analysisRoutes from "./routes/analysis.js";
import articleRoutes from "./routes/articles.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import { gemmaClient } from "./services/analysis/gemmaClient.js";

const app = express();

app.use(
  cors({
    origin: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/health/model", async (_req, res) => {
  try {
    const result = await gemmaClient.checkHealth();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(503).json({
      ok: false,
      model: env.GEMMA_MODEL,
      error: error.message
    });
  }
});

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/articles", articleRoutes);
app.use("/analysis", analysisRoutes);

app.listen(env.PORT, () => {
  console.log(`Luma backend listening on port ${env.PORT}`);
});
