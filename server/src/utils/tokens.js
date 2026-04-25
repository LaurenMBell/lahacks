import crypto from "crypto";

export function createVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}
