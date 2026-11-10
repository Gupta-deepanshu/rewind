import { z } from "zod";

/**
 * The filters the clerk understands, and how untrusted input (the model's answer, or the `f=`
 * URL parameter) is turned into them.
 *
 * Every field is checked on its own: a bad runtime drops only the runtime, not the whole search,
 * and the user is told what was left out.
 */

export const SORTS = ["best_rated", "most_popular", "newest", "oldest"] as const;
export type Sort = (typeof SORTS)[number];

const id = z.int().positive();
const name = z.string().trim().min(1).max(80);

export const GenreSchema = z.object({ id, name });
export const KeywordSchema = z.object({ id, name });
/** `cast` people act in the film; `crew` people made it (director, writer, composer…). */
export const PersonSchema = z.object({ id, name, role: z.enum(["cast", "crew"]) });

export type Genre = z.infer<typeof GenreSchema>;
export type Keyword = z.infer<typeof KeywordSchema>;
export type Person = z.infer<typeof PersonSchema>;

/** At most this many of each list, so a filter can't grow a huge TMDB query. */
export const MAX_LIST = 5;

const isoDate = z.iso.date();
const minutes = z.int().min(1).max(1000);
const rating = z.number().min(0).max(10);
const votes = z.int().min(0).max(1_000_000);
/** ISO 639-1, lowercase: "ko", "fr". */
const language = z.string().regex(/^[a-z]{2}$/);

export type Filters = {
  genres: Genre[];
  keywords: Keyword[];
  people: Person[];
  /** Release date range, inclusive, as YYYY-MM-DD. */
  releasedFrom?: string;
  releasedTo?: string;
  /** Runtime range in minutes, inclusive. */
  runtimeMin?: number;
  runtimeMax?: number;
  /** TMDB average rating out of 10. */
  minRating?: number;
  minVotes?: number;
  language?: string;
  sort?: Sort;
};

export const emptyFilters = (): Filters => ({ genres: [], keywords: [], people: [] });

/** The parts of a request that couldn't be used, in words the clerk can say back. */
export type Dropped = { field: keyof Filters; what: string };

const LIST_WHAT = { genres: "a genre", keywords: "a keyword", people: "a person" } as const;

/** Which items in a list are valid; duplicates (same id) are kept once. */
function listOf<T extends { id: number }>(
  field: "genres" | "keywords" | "people",
  schema: z.ZodType<T>,
  raw: unknown,
  dropped: Dropped[],
): T[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    dropped.push({ field, what: LIST_WHAT[field] });
    return [];
  }
  const out: T[] = [];
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (!r.success) {
      const label = typeof (item as { name?: unknown })?.name === "string" ? `"${(item as { name: string }).name}"` : LIST_WHAT[field];
      dropped.push({ field, what: label.slice(0, 82) });
    } else if (!out.some((o) => o.id === r.data.id)) out.push(r.data);
  }
  if (out.length > MAX_LIST) dropped.push({ field, what: `some of the ${field}` });
  return out.slice(0, MAX_LIST);
}

/** A single optional value: kept if valid, dropped (and noted) if present but invalid. */
function one<T>(field: keyof Filters, what: string, schema: z.ZodType<T>, raw: unknown, dropped: Dropped[]): T | undefined {
  if (raw === undefined || raw === null) return undefined;
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  dropped.push({ field, what });
  return undefined;
}

/**
 * Turns anything (the model's answer, a decoded URL parameter) into valid Filters, field by
 * field. Never throws. Unknown keys are ignored.
 */
export function sanitizeFilters(raw: unknown): { filters: Filters; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const filters: Filters = {
    genres: listOf("genres", GenreSchema, r.genres, dropped),
    keywords: listOf("keywords", KeywordSchema, r.keywords, dropped),
    people: listOf("people", PersonSchema, r.people, dropped),
  };

  let from = one("releasedFrom", "the release dates", isoDate, r.releasedFrom, dropped);
  let to = one("releasedTo", "the release dates", isoDate, r.releasedTo, dropped);
  if (from && to && from > to) {
    dropped.push({ field: "releasedFrom", what: "the release dates" });
    from = to = undefined;
  }

  let min = one("runtimeMin", "the running time", minutes, r.runtimeMin, dropped);
  let max = one("runtimeMax", "the running time", minutes, r.runtimeMax, dropped);
  if (min !== undefined && max !== undefined && min > max) {
    dropped.push({ field: "runtimeMin", what: "the running time" });
    min = max = undefined;
  }

  const set = <K extends keyof Filters>(k: K, v: Filters[K] | undefined) => {
    if (v !== undefined) filters[k] = v;
  };
  set("releasedFrom", from);
  set("releasedTo", to);
  set("runtimeMin", min);
  set("runtimeMax", max);
  set("minRating", one("minRating", "the rating", rating, r.minRating, dropped));
  set("minVotes", one("minVotes", "the number of votes", votes, r.minVotes, dropped));
  set("language", one("language", "the language", language, r.language, dropped));
  set("sort", one("sort", "the sort order", z.enum(SORTS), r.sort, dropped));

  // a range counts once in the "couldn't use" list, even when both ends were bad
  const seen = new Set<string>();
  return { filters, dropped: dropped.filter((d) => !seen.has(d.what) && Boolean(seen.add(d.what))) };
}

/** The filters that hold a single value (the rest are lists). */
export type SingleField = Exclude<keyof Filters, "genres" | "keywords" | "people">;

/** The filters without these single-value fields. */
export function omit(f: Filters, ...keys: SingleField[]): Filters {
  const out = { ...f };
  for (const k of keys) delete out[k];
  return out;
}

/** True when no filter narrows the search (sort alone doesn't). */
export function isEmpty(f: Filters): boolean {
  return (
    !f.genres.length &&
    !f.keywords.length &&
    !f.people.length &&
    [f.releasedFrom, f.releasedTo, f.runtimeMin, f.runtimeMax, f.minRating, f.minVotes, f.language].every((v) => v === undefined)
  );
}
