import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { assertMockPaymentAllowed } from "@/lib/utils/mock-payment-guard";
import { mockTopupSchema } from "@/lib/validations/payment";
import { WalletService } from "@/lib/services/wallet/WalletService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource payment
 */
export async function POST(request: NextRequest) {
  try {
    assertMockPaymentAllowed("模拟充值");
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const input = mockTopupSchema.parse(body);
    const wallet = await WalletService.mockTopUp(actor.userId, input.amount, input.channel);
    return ok(wallet, 200);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
