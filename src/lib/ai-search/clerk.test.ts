/** @jest-environment node */
import { askClerk, type ClerkDeps, type Tape } from "./clerk";
import type { FallbackReason, Interpretation } from "./interpret";
import { RateLimiter, TtlCache } from "./limits";
import { MAX_QUERY_LENGTH } from "./prompt";
import { emptyFilters, type Filters } from "./schema";

const TODAY = "2026-11-10";
const tape = (i: number): Tape => ({ slug: `${i}-film-${i}`, title: `Film ${i}`, year: 2000 });
const tapes = (n: number) => Array.from({ length: n }, (_, i) => tape(i + 1));

const nolanCaine: Filters = {
  ...emptyFilters(),
  people: [
    { id: 525, name: "Christopher Nolan", role: "crew" },
    { id: 3895, name: "Michael Caine", role: "cast" },
  ],
  sort: "best_rated",
};
const fallsBack = (reason: FallbackReason) => jest.fn(async (): Promise<Interpretation> => ({ kind: "fallback", reason }));
const understood = (filters: Filters, comment = "Pulled Nolan pictures with Caine."): Interpretation => ({ kind: "ok", filters, comment, dropped: [], vague: false });

function deps(over: Partial<ClerkDeps> = {}): ClerkDeps & { [K in "interpret" | "discover" | "titleSearch"]: jest.Mock } {
  return {
    today: TODAY,
    visitor: "1.2.3.4",
    canDiscover: true,
    limiter: new RateLimiter(10, 60_000),
    cache: new TtlCache<Interpretation>(60_000),
    interpret: jest.fn(async () => understood(nolanCaine)),
    discover: jest.fn(async () => ({ films: tapes(3), total: 3 })),
    titleSearch: jest.fn(async () => [tape(9)]),
    ...over,
  } as never;
}

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe("askClerk: the model understood", () => {
  it("searches TMDB with the filters and shows them as chips", async () => {
    const d = deps();
    const answer = await askClerk("  Christopher Nolan   films with Michael Caine ", undefined, d);
    expect(d.interpret).toHaveBeenCalledWith("Christopher Nolan films with Michael Caine");
    expect(d.discover).toHaveBeenCalledWith(expect.objectContaining({ with_crew: "525", with_cast: "3895", sort_by: "vote_average.desc" }));
    expect(answer).toEqual({
      query: "Christopher Nolan films with Michael Caine",
      mode: "ai",
      comment: "Pulled Nolan pictures with Caine.",
      filters: nolanCaine,
      dropped: [],
      films: tapes(3),
      total: 3,
    });
  });

  it("passes on the parts that couldn't be used", async () => {
    const d = deps({ interpret: jest.fn(async () => ({ ...understood(nolanCaine), dropped: ['"Jon Smithee"'] })) });
    expect((await askClerk("x", undefined, d)).dropped).toEqual(['"Jon Smithee"']);
  });
});

describe("askClerk: filters from the URL (a removed chip, a shared link)", () => {
  it("re-runs only the TMDB search, with a line written from the filters", async () => {
    const d = deps();
    const onlyCaine = { ...nolanCaine, people: [nolanCaine.people[1]] };
    const answer = await askClerk("nolan with caine", { filters: onlyCaine, dropped: [] }, d);
    expect(d.interpret).not.toHaveBeenCalled();
    expect(answer).toMatchObject({ mode: "edited", comment: "Pulled films with Michael Caine, best rated first.", filters: onlyCaine });
  });
});

describe("askClerk: off-topic", () => {
  it("refuses without calling TMDB", async () => {
    const d = deps({ interpret: jest.fn(async (): Promise<Interpretation> => ({ kind: "off_topic", comment: "I only know films." })) });
    expect(await askClerk("write my essay", undefined, d)).toEqual({
      query: "write my essay",
      mode: "off_topic",
      comment: "I only know films.",
      dropped: [],
      films: [],
      total: 0,
    });
    expect(d.discover).not.toHaveBeenCalled();
    expect(d.titleSearch).not.toHaveBeenCalled();
  });
});

describe("askClerk: zero results", () => {
  const strict: Filters = { ...emptyFilters(), genres: [{ id: 16, name: "Animation" }], keywords: [{ id: 1, name: "heist" }], runtimeMax: 60, minRating: 9 };

  it("suggests dropping the first filter that would find something", async () => {
    // only searches without the rating find anything; dropping the themes first doesn't help
    const d = deps({
      interpret: jest.fn(async () => understood(strict)),
      discover: jest.fn(async (p: Record<string, unknown>) => (p["vote_average.gte"] === undefined ? { films: tapes(2), total: 2 } : { films: [], total: 0 })),
    });
    const answer = await askClerk("x", undefined, d);
    expect(answer.total).toBe(0);
    expect(answer.suggestion).toEqual({ drop: "the rating", filters: { ...emptyFilters(), genres: strict.genres, keywords: strict.keywords, runtimeMax: 60 } });
  });

  it("tries at most three looser searches, and suggests nothing if none helps", async () => {
    const d = deps({ interpret: jest.fn(async () => understood(strict)), discover: jest.fn(async () => ({ films: [], total: 0 })) });
    const answer = await askClerk("x", undefined, d);
    expect(answer.suggestion).toBeUndefined();
    expect(d.discover).toHaveBeenCalledTimes(1 + 3);
  });

  it("never suggests removing every filter", async () => {
    const onlyGenre = { ...emptyFilters(), genres: [{ id: 37, name: "Western" }] };
    const d = deps({ interpret: jest.fn(async () => understood(onlyGenre)), discover: jest.fn(async () => ({ films: [], total: 0 })) });
    expect((await askClerk("x", undefined, d)).suggestion).toBeUndefined();
    expect(d.discover).toHaveBeenCalledTimes(1);
  });
});

describe("askClerk: falling back", () => {
  it("uses the rules when the model is unavailable, and says why", async () => {
    const d = deps({ interpret: fallsBack("timeout") });
    const answer = await askClerk("90s comedies under two hours", undefined, d);
    expect(answer).toMatchObject({
      mode: "rules",
      notice: "My AI helper took too long, so I matched the words myself.",
      comment: "Pulled comedy films from the 1990s under 120 minutes, most popular first.",
      filters: { genres: [{ id: 35, name: "Comedy" }], releasedFrom: "1990-01-01", releasedTo: "1999-12-31", runtimeMax: 120 },
    });
  });

  it("searches titles for the raw words when the rules don't understand either", async () => {
    const d = deps({ interpret: fallsBack("ai_busy") });
    const answer = await askClerk("Christopher Nolan with Michael Caine", undefined, d);
    expect(d.titleSearch).toHaveBeenCalledWith("Christopher Nolan with Michael Caine");
    expect(answer).toMatchObject({
      mode: "keyword",
      notice: "My AI helper is swamped right now, so I searched titles for “Christopher Nolan with Michael Caine” instead.",
      films: [tape(9)],
      total: 1,
    });
    expect(answer.filters).toBeUndefined();
  });

  it("falls back to a title search when TMDB's discover fails", async () => {
    const d = deps({ discover: jest.fn(async () => Promise.reject(new Error("TMDB 500"))) });
    const answer = await askClerk("nolan", undefined, d);
    expect(answer).toMatchObject({ mode: "keyword", notice: expect.stringContaining("film database hiccupped") });
  });

  it("still answers when the title search fails too", async () => {
    const d = deps({
      interpret: fallsBack("ai_error"),
      titleSearch: jest.fn(async () => Promise.reject(new Error("down"))),
    });
    expect(await askClerk("zzz", undefined, d)).toMatchObject({ mode: "keyword", films: [], comment: "Nothing on the shelves with “zzz” in the title." });
  });

  it("without TMDB, searches the example shelf and never calls the model", async () => {
    const d = deps({ canDiscover: false });
    expect(await askClerk("nolan", undefined, d)).toMatchObject({ mode: "keyword", notice: expect.stringContaining("isn't connected") });
    expect(d.interpret).not.toHaveBeenCalled();
  });

  it("refuses over-long requests before anything runs", async () => {
    const d = deps();
    const answer = await askClerk("x".repeat(MAX_QUERY_LENGTH + 1), undefined, d);
    expect(answer.mode).toBe("refused");
    expect(d.interpret).not.toHaveBeenCalled();
    expect(d.titleSearch).not.toHaveBeenCalled();
  });
});

describe("askClerk: cost controls", () => {
  it("asks the model once for the same words, however they're spaced or capitalised", async () => {
    const d = deps();
    await askClerk("Nolan with Caine", undefined, d);
    await askClerk("  nolan   WITH caine", undefined, d);
    expect(d.interpret).toHaveBeenCalledTimes(1);
  });

  it("shares one model call between identical requests arriving together", async () => {
    const d = deps();
    await Promise.all([askClerk("nolan", undefined, d), askClerk("nolan", undefined, d)]);
    expect(d.interpret).toHaveBeenCalledTimes(1);
  });

  it("doesn't cache a fallback, so the next try asks the model again", async () => {
    const d = deps({ interpret: fallsBack("ai_busy") });
    await askClerk("90s horror", undefined, d);
    await new Promise((r) => setTimeout(r, 0));
    await askClerk("90s horror", undefined, d);
    expect(d.interpret).toHaveBeenCalledTimes(2);
  });

  it("rate-limits model calls per visitor, falling back to the rules; cached answers are free", async () => {
    const d = deps({ limiter: new RateLimiter(2, 60_000) });
    await askClerk("a", undefined, d);
    await askClerk("b", undefined, d);
    await askClerk("a", undefined, d); // cached: doesn't count
    const third = await askClerk("80s horror", undefined, d);
    expect(d.interpret).toHaveBeenCalledTimes(2);
    expect(third).toMatchObject({ mode: "rules", notice: "You're asking faster than I can think, so I matched the words myself." });
    // another visitor still gets the model
    await askClerk("80s horror", undefined, { ...d, visitor: "5.6.7.8" });
    expect(d.interpret).toHaveBeenCalledTimes(3);
  });
});
