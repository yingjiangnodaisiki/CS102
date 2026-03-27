import { z } from "zod";

export const listCertificationsForAdminSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]).optional()
});

export const resolveCertificationSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().min(6).max(1000)
});
