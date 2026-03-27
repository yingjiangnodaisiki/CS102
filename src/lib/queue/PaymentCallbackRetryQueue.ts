import Bull, { Queue } from "bull";
import { AppError } from "@/lib/errors/AppError";

export interface PaymentCallbackRetryJobData {
  orderNo: string;
  providerTradeNo: string;
  paymentStatus: "SUCCESS" | "FAILED";
  requestIp?: string | null;
  requestDevice?: string | null;
  reason: string;
}

const RETRYABLE_APP_ERROR_CODES = new Set([
  "ESCROW_CALLBACK_IN_PROGRESS",
  "WALLET_CONFLICT",
  "INSUFFICIENT_BALANCE",
  "FROZEN_BALANCE_INVALID"
]);

let paymentCallbackRetryQueue: Queue<PaymentCallbackRetryJobData> | null | undefined;

function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || "6379"),
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace("/", "")) || 0 : 0
  };
}

function getPaymentCallbackRetryQueue(): Queue<PaymentCallbackRetryJobData> | null {
  if (paymentCallbackRetryQueue !== undefined) {
    return paymentCallbackRetryQueue;
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    paymentCallbackRetryQueue = null;
    return paymentCallbackRetryQueue;
  }
  paymentCallbackRetryQueue = new Bull<PaymentCallbackRetryJobData>("payment-callback-retry", {
    redis: parseRedisUrl(redisUrl),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: 1000
    }
  });
  return paymentCallbackRetryQueue;
}

export async function enqueuePaymentCallbackRetry(data: PaymentCallbackRetryJobData): Promise<boolean> {
  const queue = getPaymentCallbackRetryQueue();
  if (!queue) {
    return false;
  }
  const jobId = `payment-callback:${data.orderNo}:${data.providerTradeNo}:${data.paymentStatus}`;
  try {
    await queue.add(data, { jobId });
    return true;
  } catch {
    return false;
  }
}

export function shouldEnqueuePaymentCallbackRetry(error: unknown): boolean {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      return true;
    }
    return RETRYABLE_APP_ERROR_CODES.has(error.code);
  }
  return true;
}
