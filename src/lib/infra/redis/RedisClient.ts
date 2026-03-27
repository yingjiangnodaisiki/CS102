import Redis from "ioredis";

let redisClient: Redis | null | undefined;
let redisDisabledUntil = 0;
const REDIS_DISABLE_WINDOW_MS = 30_000;

function canUseRedis(): boolean {
  if (!process.env.REDIS_URL) {
    return false;
  }
  if (Date.now() < redisDisabledUntil) {
    return false;
  }
  return true;
}

export function getRedisClient(): Redis | null {
  if (!canUseRedis()) {
    redisClient = null;
    return null;
  }
  if (redisClient !== undefined) {
    return redisClient;
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null
  });
  redisClient.on("error", () => {
    redisDisabledUntil = Date.now() + REDIS_DISABLE_WINDOW_MS;
    if (redisClient) {
      redisClient.disconnect(false);
    }
    redisClient = null;
  });
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }
  await redisClient.quit();
  redisClient = undefined;
}
