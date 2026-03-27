import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { BidService } from "@/lib/services/bid/BidService";
import { updateBidSchema } from "@/lib/validations/bid";

/**
 * @permission authenticated
 * @role developer
 * @resource bid
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const payload = updateBidSchema.parse(body);
    const meta = await getRequestMeta();

    const updated = await BidService.updateBid(actor, {
      bidId: id,
      ...payload,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(updated, 200);
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
