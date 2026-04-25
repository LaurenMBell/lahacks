import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const surveySchema = z.object({
  ageRange: z.string().optional().nullable(),
  sexAssignedAtBirth: z.string().optional().nullable(),
  conditions: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  goals: z.string().optional().nullable()
});

router.get("/me", requireAuth, async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      emailVerified: req.user.emailVerified
    },
    medicalProfile: req.user.medicalProfile
  });
});

router.post("/onboarding", requireAuth, async (req, res) => {
  const parsed = surveySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid onboarding payload" });
  }

  const profile = await prisma.medicalProfile.upsert({
    where: { userId: req.user.id },
    update: parsed.data,
    create: {
      userId: req.user.id,
      ...parsed.data
    }
  });

  return res.status(200).json({ medicalProfile: profile });
});

export default router;
