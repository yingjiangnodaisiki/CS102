import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { paymentCallbackSchema, type PaymentCallbackInput } from "@/lib/validations/escrow";
import { EscrowService } from "@/lib/services/payment/EscrowService";
import { verifyHmacSha256Signature } from "@/lib/utils/signature";
import { RateLimiterService } from "@/lib/infra/redis/RateLimiterService";
import {
  enqueuePaymentCallbackRetry,
  shouldEnqueuePaymentCallbackRetry
} from "@/lib/queue/PaymentCallbackRetryQueue";

/**
 * @permission public
 * @role payment-provider
 * @resource payment
 */
export async function POST(request: NextRequest) {
  let payload: PaymentCallbackInput | null = null;
  let meta: { ip: string | null; device: string | null } | null = null;
  try {
    const secret = process.env.PAYMENT_CALLBACK_SECRET;
    if (!secret) {
      throw new AppError("CONFIG_MISSING", "PAYMENT_CALLBACK_SECRET 未配置", 500);
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-payment-signature");
    if (!signature || !verifyHmacSha256Signature(rawBody, signature, secret)) {
      throw new AppError("PAYMENT_SIGNATURE_INVALID", "支付回调签名校验失败", 401);
    }

    const body: unknown = JSON.parse(rawBody);
    payload = paymentCallbackSchema.parse(body);
    meta = await getRequestMeta();

    const rateLimit = await RateLimiterService.checkLimit({
      key: `payment:callback:ip:${meta.ip ?? "unknown"}`,
      limit: 20,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return fail("RATE_LIMITED", "支付回调请求过于频繁，请稍后重试", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }

    const result = await EscrowService.handlePaymentCallback({
      ...payload,
      requestIp: meta.ip,
      requestDevice: meta.device
    });
    return ok(result, 200);
  } catch (error: unknown) {
    if (payload && payload.paymentStatus === "SUCCESS" && shouldEnqueuePaymentCallbackRetry(error)) {
      await enqueuePaymentCallbackRetry({
        ...payload,
        requestIp: meta?.ip ?? null,
        requestDevice: meta?.device ?? null,
        reason: error instanceof AppError ? `${error.code}:${error.message}` : "UNKNOWN_ERROR"
      });
    }
    if (error instanceof ZodError) {
      return fail("VALIDATION_ERROR", "参数校验失败", 422, { issues: error.issues });
    }
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
