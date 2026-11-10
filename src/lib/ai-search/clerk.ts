import { describeFilters } from "./comment";
import { toDiscoverParams, type DiscoverParams } from "./discover";
import type { FallbackReason, Interpretation } from "./interpret";
import type { RateLimiter, TtlCache } from "./limits";
import { MAX_QUERY_LENGTH } from "./prompt";
import { parseWithRules } from "./rules";
import { isEmpty, omit, type Dropped, type Filters, type SingleField } from "./schema";

/**
 * Asking the clerk, start to finish: from the customer's words (or already-resolved filters
 * from the URL) to tapes on the shelf and a line to say about them.
 *
 *   filters in the URL ──────────────────────────────┐
 *   query ─▶ cache? ─▶ rate limit ─▶ model ─ ok ─────┼─▶ /discover/movie ─▶ zero? suggest a looser search
 *                                         ├ off-topic ─▶ refuse (no TMDB call)
 *                                         └ fallback ─▶ rules ─ understood ─┘
 *                                                             └ not understood ─▶ title search
 *
 * Everything it needs is passed in, so it runs the same in tests as on the server.
 */

/** The tapes, as the shelf shows them. */
export type Tape = { slug: string; title: string; year: number; directorName?: string; poster?: string };

export type ClerkMode =
  /** The model understood the request. */
  | "ai"
  /** Filters came from the URL (a chip was removed, or a shared link): no model call. */
  | "edited"
  /** The model wasn't available; the rule-based parser understood the request. */
  | "rules"
  /** Nothing understood it; this is a plain title search for the words. */
  | "keyword"
  | "off_topic"
  /** The request was refused before anything ran (too long). */
  | "refused";

export type ClerkAnswer = {
  query: string;
  mode: ClerkMode;
  /** The clerk's one line about what was searched. */
  comment: string;
  /** Why the clerk didn't use the model this time, when it didn't. */
  notice?: string;
  /** The filters used, shown as chips. Absent for keyword, off-topic and refused answers. */
  filters?: Filters;
  /** Parts of the request that couldn't be used. */
  dropped: string[];
  films: Tape[];
  /** How many films match in all (the shelf shows the first 40). */
  total: number;
  /** With zero results: one filter to drop that would find something. */
  suggestion?: { drop: string; filters: Filters };
};

export type ClerkDeps = {
  today: string;
  /** Who is asking, for the rate limit. */
  visitor: string;
  interpret(query: string): Promise<Interpretation>;
  discover(params: DiscoverParams): Promise<{ films: Tape[]; total: number }>;
  /** A plain title search, used when nothing else understood the request. */
  titleSearch(query: string): Promise<Tape[]>;
  /** False when TMDB isn't configured: then filters can't be searched, only example titles. */
  canDiscover: boolean;
  limiter: RateLimiter;
  cache: TtlCache<Interpretation>;
};

/** Spaces tidied and the length checked; the cache key and the model both see this. */
export const normalizeQuery = (q: string) => q.replace(/\s+/g, " ").trim();

const FALLBACK_CAUSE: Record<FallbackReason, string> = {
  no_model: "My AI helper isn't switched on here",
  rate_limited: "You're asking faster than I can think",
  ai_busy: "My AI helper is swamped right now",
  ai_quota: "My AI helper has answered all the questions it can for today",
  timeout: "My AI helper took too long",
  ai_error: "My AI helper got its wires crossed",
  no_answer: "My AI helper couldn't make sense of that",
};

export async function askClerk(rawQuery: string, fromUrl: { filters: Filters; dropped: Dropped[] } | undefined, deps: ClerkDeps): Promise<ClerkAnswer> {
  const query = normalizeQuery(rawQuery);

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      query: query.slice(0, MAX_QUERY_LENGTH),
      mode: "refused",
      comment: `That's a long one. Keep it under ${MAX_QUERY_LENGTH} characters and I'll take a look.`,
      dropped: [],
      films: [],
      total: 0,
    };
  }

  // without TMDB nothing can be filtered, so don't spend a model call working out filters
  if (!deps.canDiscover) {
    return titleSearch(query, "The film database isn't connected here, so I searched the example shelf by title.", deps);
  }

  // a chip was removed, or the link was shared: the filters are already known
  if (fromUrl) {
    return shelve(query, "edited", fromUrl.filters, describeFilters(fromUrl.filters), fromUrl.dropped.map((d) => d.what), deps);
  }

  const interpretation = await interpretOnce(query, deps);

  if (interpretation.kind === "off_topic") {
    return { query, mode: "off_topic", comment: interpretation.comment, dropped: [], films: [], total: 0 };
  }
  if (interpretation.kind === "ok") {
    return shelve(query, "ai", interpretation.filters, interpretation.comment, interpretation.dropped, deps);
  }

  const cause = FALLBACK_CAUSE[interpretation.reason];
  const rules = parseWithRules(query, deps.today);
  if (rules.understood) {
    const answer = await shelve(query, "rules", rules.filters, describeFilters(rules.filters), [], deps);
    return answer.mode === "rules" ? { ...answer, notice: `${cause}, so I matched the words myself.` } : answer;
  }
  return titleSearch(query, `${cause}, so I searched titles for “${query}” instead.`, deps);
}

/** The cached interpretation, or a new one if this visitor is still under the limit. */
async function interpretOnce(query: string, deps: ClerkDeps): Promise<Interpretation> {
  const key = `${deps.today}|${query.toLowerCase()}`; // "the last five years" depends on the date
  const cached = deps.cache.get(key);
  if (cached) return cached;
  if (!deps.limiter.take(deps.visitor)) return { kind: "fallback", reason: "rate_limited" };
  const pending = deps.interpret(query);
  // only real answers are worth keeping; a timeout or a busy model should be retried next time
  deps.cache.set(key, pending, (i) => i.kind !== "fallback");
  return pending;
}

async function shelve(query: string, mode: "ai" | "edited" | "rules", filters: Filters, comment: string, dropped: string[], deps: ClerkDeps): Promise<ClerkAnswer> {
  let found: { films: Tape[]; total: number };
  try {
    found = await deps.discover(toDiscoverParams(filters, deps.today));
  } catch (e) {
    console.error("[ai-search] discover failed.", e instanceof Error ? e.message : e);
    return titleSearch(query, `The film database hiccupped, so I searched titles for “${query}” instead.`, deps);
  }

  const answer: ClerkAnswer = { query, mode, comment, filters, dropped, films: found.films, total: found.total };
  if (found.total === 0) {
    answer.suggestion = await loosen(filters, deps);
  }
  return answer;
}

/**
 * Filters that can be dropped, most likely culprit first: themes and runtimes rule out the most
 * films, genres and people are usually the point of the request.
 */
const hasAny = (f: Filters, ...keys: SingleField[]) => keys.some((k) => f[k] !== undefined);

const LOOSENERS: { drop: string; has: (f: Filters) => boolean; without: (f: Filters) => Filters }[] = [
  { drop: "the themes", has: (f) => f.keywords.length > 0, without: (f) => ({ ...f, keywords: [] }) },
  { drop: "the rating", has: (f) => hasAny(f, "minRating", "minVotes"), without: (f) => omit(f, "minRating", "minVotes") },
  { drop: "the running time", has: (f) => hasAny(f, "runtimeMin", "runtimeMax"), without: (f) => omit(f, "runtimeMin", "runtimeMax") },
  { drop: "the dates", has: (f) => hasAny(f, "releasedFrom", "releasedTo"), without: (f) => omit(f, "releasedFrom", "releasedTo") },
  { drop: "the language", has: (f) => hasAny(f, "language"), without: (f) => omit(f, "language") },
  { drop: "the genres", has: (f) => f.genres.length > 0, without: (f) => ({ ...f, genres: [] }) },
];

/** Max extra TMDB searches spent looking for a looser search that finds something. */
const MAX_LOOSEN_TRIES = 3;

async function loosen(filters: Filters, deps: ClerkDeps): Promise<ClerkAnswer["suggestion"]> {
  const candidates = LOOSENERS.filter((l) => l.has(filters)).slice(0, MAX_LOOSEN_TRIES);
  for (const l of candidates) {
    const looser = l.without(filters);
    if (isEmpty(looser)) continue; // "drop everything" isn't a suggestion
    try {
      const { total } = await deps.discover(toDiscoverParams(looser, deps.today));
      if (total > 0) return { drop: l.drop, filters: looser };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function titleSearch(query: string, notice: string, deps: ClerkDeps): Promise<ClerkAnswer> {
  let films: Tape[] = [];
  try {
    films = await deps.titleSearch(query);
  } catch (e) {
    console.error("[ai-search] title search failed.", e instanceof Error ? e.message : e);
  }
  return {
    query,
    mode: "keyword",
    comment: films.length ? `Here's what I found with “${query}” in the title.` : `Nothing on the shelves with “${query}” in the title.`,
    notice,
    dropped: [],
    films,
    total: films.length,
  };
}
