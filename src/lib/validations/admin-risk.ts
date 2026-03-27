import { z } from "zod";

export const listRiskEventsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "IN_REVIEW", "MITIGATED", "FALSE_POSITIVE"]).optional(),
  type: z.enum(["BID_COLLUSION", "PAYMENT_ANOMALY", "ACCOUNT_ABUSE", "DISPUTE_SPIKE"]).optional()
});

export const actionRiskEventSchema = z.object({
  action: z.enum(["MARK_FALSE_POSITIVE", "MARK_MITIGATED", "FREEZE_DEVELOPER", "ESCALATE_REVIEW"]),
  note: z.string().min(4).max(500)
});

export const listReviewCasesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  targetType: z.enum(["PROJECT", "BID", "DISPUTE", "USER", "PAYMENT", "CERTIFICATION"]).optional()
});

export const resolveReviewCaseSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().min(6).max(1000)
});
