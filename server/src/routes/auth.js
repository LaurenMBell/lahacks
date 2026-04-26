import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config.js";
import { prisma } from "../prisma.js";
import { signAuthToken } from "../utils/auth.js";
import { sendVerificationEmail } from "../utils/email.js";
import { createVerificationToken } from "../utils/tokens.js";

const router = Router();
const EMAIL_SEND_TIMEOUT_MS = 8000;

const signupSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid signup payload" });
  }

  const { email, fullName, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const token = createVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName,
      passwordHash,
      verificationTokens: {
        create: {
          token,
          expiresAt
        }
      }
    }
  });

  let delivery;
  try {
    delivery = await Promise.race([
      sendVerificationEmail({
        email: user.email,
        fullName: user.fullName,
        token
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Email delivery timed out"));
        }, EMAIL_SEND_TIMEOUT_MS);
      })
    ]);
  } catch (_error) {
    delivery = {
      sent: false,
      verifyUrl: `${env.APP_BASE_URL}/auth/verify?token=${token}`
    };
  }

  return res.status(201).json({
    message: delivery.sent
      ? "Signup created. Check your email for a verification link."
      : "Signup created. Email provider not configured yet.",
    emailSent: delivery.sent,
    verificationPreviewUrl: delivery.sent ? null : delivery.verifyUrl
  });
});

router.get("/verify", async (req, res) => {
  const tokenSchema = z.object({
    token: z.string().min(1)
  });
  const parsed = tokenSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).send("Missing verification token");
  }

  const verification = await prisma.emailVerificationToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true }
  });

  if (!verification) {
    return res.status(404).send("Verification token not found");
  }

  if (verification.usedAt) {
    return res.status(400).send("Verification token already used");
  }

  if (verification.expiresAt < new Date()) {
    return res.status(400).send("Verification token expired");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: { emailVerified: true }
    }),
    prisma.emailVerificationToken.update({
      where: { id: verification.id },
      data: { usedAt: new Date() }
    })
  ]);

  return res
    .status(200)
    .send("Email verified. You can return to the Luma extension and sign in.");
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid login payload" });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { medicalProfile: true }
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!matches) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: "Email not verified" });
  }

  const token = signAuthToken(user);

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      emailVerified: user.emailVerified,
      medicalProfile: user.medicalProfile
    }
  });
});

export default router;
