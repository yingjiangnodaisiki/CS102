import jwt from "jsonwebtoken";
import { AppError } from "@/lib/errors/AppError";

export interface AccessTokenPayload {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) {
    throw new AppError("CONFIG_MISSING", "JWT_ACCESS_SECRET is required", 500);
  }
  return jwtSecret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
}
