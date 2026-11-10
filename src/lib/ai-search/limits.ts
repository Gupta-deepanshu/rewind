/**
 * Two small in-memory helpers that keep the clerk cheap: a per-IP rate limit and a short cache
 * of interpretations.
 *
 * Known limitation: on serverless hosting (Vercel) each instance has its own memory, so both
 * are per instance, not global. A shared store such as Redis (Upstash) fixes that; see README.
 */

/** A sliding-window limit: at most `limit` hits per key in any `windowMs`. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    /** Keys remembered at most; the oldest are forgotten first, so memory stays bounded. */
    private readonly maxKeys = 5000,
  ) {}

  /** Records a hit and says whether it is allowed. A refused hit isn't counted. */
  take(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.delete(key); // re-insert so Map order is least recently used first
    this.hits.set(key, recent);
    while (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value!);
    return true;
  }
}

/**
 * A small time-limited cache of promises. Storing the promise (not the value) means identical
 * requests arriving together share one model call.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: Promise<T>; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): Promise<T> | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return e.value;
  }

  /**
   * Stores a pending value. Once it settles, it is dropped again if it failed or `keep` says
   * it isn't worth keeping (a timeout shouldn't be served to the next visitor).
   */
  set(key: string, value: Promise<T>, keep: (v: T) => boolean = () => true): void {
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const forget = () => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    };
    value.then((v) => !keep(v) && forget(), forget);
  }
}
