import cors from "cors";
import express from "express";
import { env } from "./config.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import summarizeRoutes from "./routes/summarize.js";

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

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/", summarizeRoutes);

app.listen(env.PORT, () => {
  console.log(`Luma backend listening on port ${env.PORT}`);
});
