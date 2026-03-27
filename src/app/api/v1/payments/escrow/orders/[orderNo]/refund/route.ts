import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { refundEscrowSchema } from "@/lib/validations/escrow";
import { EscrowService } from "@/lib/services/payment/EscrowService";

/**
 * @permission authenticated
 * @role client|admin
 * @resource payment
 */
export async function POST(request: NextRequest, context: { params: Promise<{ orderNo: string }> }) {
  try {
    const actor = await getAuthUser();
    const { orderNo } = await context.params;
    const body: unknown = await request.json();
    const payload = refundEscrowSchema.parse(body);
    const meta = await getRequestMeta();

    const result = await EscrowService.refundEscrowOrder(actor, {
      orderNo,
      reason: payload.reason,
      requestIp: meta.ip,
      requestDevice: meta.device
    });

    return ok(result, 200);
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
