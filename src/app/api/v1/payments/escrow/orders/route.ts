import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { createEscrowOrderSchema } from "@/lib/validations/escrow";
import { EscrowService } from "@/lib/services/payment/EscrowService";

/**
 * @permission authenticated
 * @role client
 * @resource payment
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    const body: unknown = await request.json();
    const payload = createEscrowOrderSchema.parse(body);
    const meta = await getRequestMeta();

    const order = await EscrowService.createEscrowOrder(actor, {
      ...payload,
      requestIp: meta.ip,
      requestDevice: meta.device
    });

    return ok(order, 201);
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
