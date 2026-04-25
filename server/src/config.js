import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  APP_BASE_URL: z.string().url(),
  CLIENT_APP_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  GEMMA_API_URL: z.string().url().optional(),
  GEMMA_API_KEY: z.string().optional(),
  GEMMA_MODEL: z.string().default("gemma-3-27b-it"),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().default(30000)
});

export const env = envSchema.parse(process.env);
