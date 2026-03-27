import { AppError } from "@/lib/errors/AppError";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { BidService } from "@/lib/services/bid/BidService";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource bid
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    const bids = await BidService.listMyBids(actor);
    return ok(bids, 200);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
