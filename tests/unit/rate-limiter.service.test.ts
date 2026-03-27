import { RateLimiterService } from "@/lib/infra/redis/RateLimiterService";

describe("rate limiter service", () => {
  it("should block when exceeding limit in same window", async () => {
    const key = `test:rate-limiter:${Date.now()}`;
    const first = await RateLimiterService.checkLimit({
      key,
      limit: 2,
      windowSeconds: 60
    });
    const second = await RateLimiterService.checkLimit({
      key,
      limit: 2,
      windowSeconds: 60
    });
    const third = await RateLimiterService.checkLimit({
      key,
      limit: 2,
      windowSeconds: 60
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});
