/** @jest-environment node */
import { RateLimiter, TtlCache } from "./limits";

describe("RateLimiter", () => {
  it("allows `limit` hits per window per key, then refuses until the window moves on", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect([limiter.take("a"), limiter.take("a"), limiter.take("a")]).toEqual([true, true, false]);
    expect(limiter.take("b")).toBe(true); // other visitors are unaffected
    now = 999;
    expect(limiter.take("a")).toBe(false);
    now = 1000; // the first two hits have left the window
    expect(limiter.take("a")).toBe(true);
  });

  it("doesn't count refused hits, so hammering doesn't extend the wait", () => {
    let now = 0;
    const limiter = new RateLimiter(1, 1000, () => now);
    limiter.take("a");
    for (now = 100; now < 1000; now += 100) limiter.take("a");
    now = 1000;
    expect(limiter.take("a")).toBe(true);
  });

  it("forgets the least recently seen visitors past maxKeys", () => {
    const limiter = new RateLimiter(1, 60_000, () => 0, 2);
    limiter.take("a");
    limiter.take("b");
    limiter.take("c"); // "a" is forgotten
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("c")).toBe(false);
  });
});

describe("TtlCache", () => {
  it("returns a value until it expires", async () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, () => now);
    cache.set("k", Promise.resolve(1));
    expect(await cache.get("k")).toBe(1);
    now = 1000;
    expect(cache.get("k")).toBeUndefined();
  });

  it("forgets values `keep` rejects, and failures, once they settle", async () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("timeout", Promise.resolve("fallback"), (v) => v !== "fallback");
    cache.set("broken", Promise.reject(new Error("x")));
    expect(cache.get("timeout")).toBeDefined(); // still pending: shared with anyone asking now
    await new Promise((r) => setTimeout(r, 0));
    expect(cache.get("timeout")).toBeUndefined();
    expect(cache.get("broken")).toBeUndefined();
  });

  it("keeps at most maxEntries, dropping the oldest", () => {
    const cache = new TtlCache<number>(60_000, Date.now, 2);
    cache.set("a", Promise.resolve(1));
    cache.set("b", Promise.resolve(2));
    cache.set("c", Promise.resolve(3));
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBeDefined();
  });
});
