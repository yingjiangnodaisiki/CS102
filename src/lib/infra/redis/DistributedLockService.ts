import crypto from "node:crypto";
import { getRedisClient } from "@/lib/infra/redis/RedisClient";

interface MemoryLockRecord {
  token: string;
  expiresAt: number;
}

const memoryLocks = new Map<string, MemoryLockRecord>();

function nowMs(): number {
  return Date.now();
}

function buildRedisKey(key: string): string {
  return `lock:${key}`;
}

function cleanupMemoryLock(key: string): void {
  const lock = memoryLocks.get(key);
  if (!lock) {
    return;
  }
  if (lock.expiresAt <= nowMs()) {
    memoryLocks.delete(key);
  }
}

export interface DistributedLock {
  key: string;
  token: string;
  release: () => Promise<void>;
}

export class DistributedLockService {
  static async acquire(key: string, ttlMs: number): Promise<DistributedLock | null> {
    const token = crypto.randomUUID();
    const redis = getRedisClient();
    if (redis) {
      try {
        const lockKey = buildRedisKey(key);
        const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");
        if (result !== "OK") {
          return null;
        }
        return {
          key,
          token,
          release: async () => {
            const releaseScript = `
              if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
              else
                return 0
              end
            `;
            try {
              await redis.eval(releaseScript, 1, lockKey, token);
            } catch {
              // ignore release errors in degraded mode
            }
          }
        };
      } catch {
        // Redis不可用时降级到进程内锁
      }
    }

    cleanupMemoryLock(key);
    const current = memoryLocks.get(key);
    if (current) {
      return null;
    }
    memoryLocks.set(key, {
      token,
      expiresAt: nowMs() + ttlMs
    });
    return {
      key,
      token,
      release: async () => {
        const lock = memoryLocks.get(key);
        if (!lock) {
          return;
        }
        if (lock.token === token) {
          memoryLocks.delete(key);
        }
      }
    };
  }
}
