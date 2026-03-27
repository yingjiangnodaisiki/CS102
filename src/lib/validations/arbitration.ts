import { z } from "zod";

export const resolveDisputeSchema = z
  .object({
    action: z.enum(["REJECT", "FULL_REFUND", "PARTIAL_REFUND", "RELEASE"]),
    refundAmount: z.number().positive().optional(),
    resolution: z.string().min(6).max(2000)
  })
  .superRefine((value, ctx) => {
    if (value.action === "PARTIAL_REFUND" && value.refundAmount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refundAmount"],
        message: "部分退款必须提供refundAmount"
      });
    }
    if (value.action !== "PARTIAL_REFUND" && value.refundAmount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refundAmount"],
        message: "仅部分退款允许传入refundAmount"
      });
    }
  });

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
