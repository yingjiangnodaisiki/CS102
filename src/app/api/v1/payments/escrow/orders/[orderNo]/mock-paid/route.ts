import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { assertMockPaymentAllowed } from "@/lib/utils/mock-payment-guard";
import { EscrowService } from "@/lib/services/payment/EscrowService";
import { getRequestMeta } from "@/lib/utils/request-meta";

/**
 * @permission authenticated
 * @role client|admin
 * @resource payment
 */
export async function POST(_: NextRequest, context: { params: Promise<{ orderNo: string }> }) {
  try {
    assertMockPaymentAllowed("模拟托管支付");
    const actor = await getAuthUser();
    if (!["CLIENT", "ADMIN"].includes(actor.role)) {
      throw new AppError("FORBIDDEN", "仅甲方或管理员可执行模拟支付", 403);
    }
    const { orderNo } = await context.params;
    const meta = await getRequestMeta();
    const result = await EscrowService.handlePaymentCallback({
      orderNo,
      providerTradeNo: `MOCK-${Date.now()}`,
      paymentStatus: "SUCCESS",
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(result, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
