import { z } from "zod";

export const createCertificationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  issuer: z.string().trim().min(2).max(120),
  certificateNo: z.string().trim().min(2).max(120).optional(),
  verifyUrl: z.string().trim().url().optional(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional()
});

const ALLOWED_CERTIFICATION_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const addCertificationAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().url(),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  mimeType: z.enum(ALLOWED_CERTIFICATION_ATTACHMENT_MIME_TYPES)
});
