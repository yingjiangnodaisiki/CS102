import { AppError } from "@/lib/errors/AppError";

/**
 * 正式环境默认禁止模拟资金操作；需设置 ALLOW_MOCK_PAYMENT=true（仅演示/自检）。
 */
export function assertMockPaymentAllowed(featureLabel: string): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.ALLOW_MOCK_PAYMENT === "true") {
    return;
  }
  throw new AppError(
    "MOCK_PAYMENT_DISABLED",
    `正式环境已关闭${featureLabel}。对接真实支付前请使用线上充值/托管流程；若需演示可在 Vercel 环境变量中设置 ALLOW_MOCK_PAYMENT=true（勿用于真实收款环境）。`,
    403
  );
}
