/** 钱包流水 reason 代码 → 中文说明（展示用） */
const REASON_LABELS: Record<string, string> = {
  MOCK_TOPUP: "模拟充值（测试）",
  ESCROW_FREEZE: "托管冻结",
  ESCROW_RELEASE: "托管结算（合并）",
  ESCROW_RELEASE_OUT: "托管释放（出账）",
  ESCROW_RELEASE_IN: "托管释放（入账）",
  ESCROW_REFUND: "托管退款至甲方",
  ARBITRATION_REFUND: "仲裁退款",
  ARBITRATION_RELEASE_OUT: "仲裁裁定释放（出账）",
  ARBITRATION_RELEASE_IN: "仲裁裁定释放（入账）",
  DISPUTE_REFUND: "争议退款",
  ADJUSTMENT: "人工调账"
};

export function walletTransactionReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export function walletDirectionLabel(direction: string): string {
  if (direction === "IN") {
    return "收入";
  }
  if (direction === "OUT") {
    return "支出";
  }
  return direction;
}
