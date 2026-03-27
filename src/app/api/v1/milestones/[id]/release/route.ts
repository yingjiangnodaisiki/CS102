import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { EscrowService } from "@/lib/services/payment/EscrowService";
import { RateLimiterService } from "@/lib/infra/redis/RateLimiterService";

/**
 * @permission authenticated
 * @role client|admin
 * @resource milestone
 */
export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthUser();
    const { id } = await context.params;
    const meta = await getRequestMeta();
    const rateLimit = await RateLimiterService.checkLimit({
      key: `payment:release:user:${actor.userId}`,
      limit: 20,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return fail("RATE_LIMITED", "放款请求过于频繁，请稍后重试", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }
    const result = await EscrowService.releaseMilestone(actor, id, {
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
