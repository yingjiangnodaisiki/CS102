import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { BidService } from "@/lib/services/bid/BidService";

/**
 * @permission authenticated
 * @role developer
 * @resource bid
 */
export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const meta = await getRequestMeta();
    const bid = await BidService.withdrawBid(actor, id, {
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(bid, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
