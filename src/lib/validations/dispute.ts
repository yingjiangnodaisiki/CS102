import { z } from "zod";

export const createDisputeSchema = z.object({
  projectId: z.string().uuid(),
  escrowOrderId: z.string().uuid().optional(),
  amount: z.number().positive(),
  reason: z.string().min(10).max(2000)
});

export const listDisputeAdminSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["REQUESTED", "IN_ARBITRATION", "RESOLVED", "REJECTED"]).optional(),
  projectId: z.string().uuid().optional(),
  keyword: z.string().min(1).max(100).optional()
});
