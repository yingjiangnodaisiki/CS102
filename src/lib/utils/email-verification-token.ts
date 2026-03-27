import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { AppError } from "@/lib/errors/AppError";

type EmailVerificationPurpose = "FORGOT_PASSWORD" | "CHANGE_PASSWORD";

interface EmailVerificationPayload {
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
  fingerprint: string;
}

function getEmailVerificationSecret(): string {
  return process.env.JWT_EMAIL_VERIFY_SECRET || process.env.JWT_ACCESS_SECRET || "";
}

export function getPasswordHashFingerprint(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 40);
}

export function signEmailVerificationToken(input: {
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
  passwordHash: string;
}): string {
  const secret = getEmailVerificationSecret();
  if (!secret) {
    throw new AppError("CONFIG_MISSING", "JWT_EMAIL_VERIFY_SECRET is required", 500);
  }
  const payload: EmailVerificationPayload = {
    userId: input.userId,
    email: input.email,
    purpose: input.purpose,
    fingerprint: getPasswordHashFingerprint(input.passwordHash)
  };
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

export function verifyEmailVerificationToken(
  token: string,
  expectedPurpose: EmailVerificationPurpose
): EmailVerificationPayload {
  const secret = getEmailVerificationSecret();
  if (!secret) {
    throw new AppError("CONFIG_MISSING", "JWT_EMAIL_VERIFY_SECRET is required", 500);
  }
  const payload = jwt.verify(token, secret) as EmailVerificationPayload;
  if (payload.purpose !== expectedPurpose) {
    throw new AppError("EMAIL_VERIFICATION_INVALID", "邮箱验证令牌无效或已过期", 400);
  }
  return payload;
}
