import { getRedisClient } from "@/lib/infra/redis/RedisClient";

interface MemoryRateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryRateLimits = new Map<string, MemoryRateLimitRecord>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function buildRedisKey(key: string): string {
  return `ratelimit:${key}`;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  current: number;
  retryAfterSeconds: number;
}

export class RateLimiterService {
  static async checkLimit(params: {
    key: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitCheckResult> {
    const redis = getRedisClient();
    if (redis) {
      try {
        const redisKey = buildRedisKey(params.key);
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.expire(redisKey, params.windowSeconds);
        }
        const ttl = await redis.ttl(redisKey);
        const retryAfterSeconds = ttl > 0 ? ttl : params.windowSeconds;
        return {
          allowed: count <= params.limit,
          current: count,
          retryAfterSeconds
        };
      } catch {
        // Redis不可用时降级为本地内存限流，避免请求阻塞
      }
    }

    const now = nowSeconds();
    const record = memoryRateLimits.get(params.key);
    if (!record || record.resetAt <= now) {
      memoryRateLimits.set(params.key, {
        count: 1,
        resetAt: now + params.windowSeconds
      });
      return {
        allowed: true,
        current: 1,
        retryAfterSeconds: params.windowSeconds
      };
    }
    record.count += 1;
    memoryRateLimits.set(params.key, record);
    return {
      allowed: record.count <= params.limit,
      current: record.count,
      retryAfterSeconds: Math.max(record.resetAt - now, 1)
    };
  }
}
