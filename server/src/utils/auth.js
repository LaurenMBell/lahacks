import jwt from "jsonwebtoken";
import { env } from "../config.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
