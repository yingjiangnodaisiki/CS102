import { z } from "zod";

export const createEscrowOrderSchema = z.object({
  projectId: z.string().uuid(),
  developerId: z.string().uuid(),
  amount: z.number().positive(),
  milestoneId: z.string().uuid().optional()
});

export const paymentCallbackSchema = z.object({
  orderNo: z.string().min(8).max(64),
  providerTradeNo: z.string().min(8).max(64),
  paymentStatus: z.enum(["SUCCESS", "FAILED"])
});

export type PaymentCallbackInput = z.infer<typeof paymentCallbackSchema>;

export const refundEscrowSchema = z.object({
  reason: z.string().min(4).max(500)
});
