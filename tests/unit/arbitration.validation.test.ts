import { resolveDisputeSchema } from "@/lib/validations/arbitration";

describe("arbitration validation", () => {
  it("should require refundAmount for partial refund", () => {
    const result = resolveDisputeSchema.safeParse({
      action: "PARTIAL_REFUND",
      resolution: "部分退款处理"
    });
    expect(result.success).toBe(false);
  });

  it("should reject refundAmount for full refund action", () => {
    const result = resolveDisputeSchema.safeParse({
      action: "FULL_REFUND",
      refundAmount: 100,
      resolution: "全额退款处理"
    });
    expect(result.success).toBe(false);
  });
});
