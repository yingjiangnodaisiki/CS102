import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";
import { getRequestMeta } from "@/lib/utils/request-meta";
import { paymentCallbackSchema, type PaymentCallbackInput } from "@/lib/validations/escrow";
import { EscrowService } from "@/lib/services/payment/EscrowService";
import { verifyHmacSha256Signature } from "@/lib/utils/signature";
import { RateLimiterService } from "@/lib/infra/redis/RateLimiterService";

async function tryEnqueuePaymentCallbackRetry(params: {
  payload: PaymentCallbackInput;
  meta: { ip: string | null; device: string | null } | null;
  error: unknown;
}): Promise<void> {
  // Vercel Demo 环境下禁用 Bull 队列（Turbopack 对 bull 的静态打包不兼容）
  if (process.env.VERCEL === "1") {
    return;
  }
  // 仅在显式开启时启用队列（ECS/自建环境）
  if (process.env.ENABLE_PAYMENT_CALLBACK_RETRY_QUEUE !== "true") {
    return;
  }
  // 通过运行时 require 避免构建期静态追踪
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = eval("require") as (id: string) => unknown;
  const mod = req("@/lib/queue/PaymentCallbackRetryQueue") as {
    enqueuePaymentCallbackRetry: (data: {
      orderNo: string;
      providerTradeNo: string;
      paymentStatus: "SUCCESS" | "FAILED";
      requestIp?: string | null;
      requestDevice?: string | null;
      reason: string;
    }) => Promise<boolean>;
    shouldEnqueuePaymentCallbackRetry: (error: unknown) => boolean;
  };

  if (!mod.shouldEnqueuePaymentCallbackRetry(params.error)) {
    return;
  }
  await mod.enqueuePaymentCallbackRetry({
    ...params.payload,
    requestIp: params.meta?.ip ?? null,
    requestDevice: params.meta?.device ?? null,
    reason: params.error instanceof AppError ? `${params.error.code}:${params.error.message}` : "UNKNOWN_ERROR"
  });
}

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
    if (payload && payload.paymentStatus === "SUCCESS") {
      await tryEnqueuePaymentCallbackRetry({ payload, meta, error });
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
