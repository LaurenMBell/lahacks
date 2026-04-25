import { Resend } from "resend";
import { env } from "../config.js";

const resend =
  env.RESEND_API_KEY && env.EMAIL_FROM
    ? new Resend(env.RESEND_API_KEY)
    : null;

export async function sendVerificationEmail({ email, fullName, token }) {
  const verifyUrl = `${env.APP_BASE_URL}/auth/verify?token=${token}`;

  if (!resend || !env.EMAIL_FROM) {
    return {
      sent: false,
      verifyUrl
    };
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Verify your Luma account",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2f2a26">
        <h2>Verify your email</h2>
        <p>Hi ${fullName},</p>
        <p>Click the link below to verify your Luma account:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `
  });

  return {
    sent: true,
    verifyUrl
  };
}
