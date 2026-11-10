import type { Filters } from "./schema";

/**
 * The clerk's line written from the filters themselves. Used whenever the model's own comment
 * can't be trusted to match what was searched: after a chip is removed, after a field was
 * dropped, when the model's comment was unusable, and in the rule-based fallback.
 */

export const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const andList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const year = (d: string) => Number(d.slice(0, 4));

/** A release date range in years: a whole decade, one year, a span, or open at one end. */
export type Period =
  | { kind: "decade"; from: number }
  | { kind: "year"; from: number }
  | { kind: "span"; from: number; to: number }
  | { kind: "since"; from: number }
  | { kind: "until"; to: number };

export function periodOf(from?: string, to?: string): Period | undefined {
  if (from && to) {
    const [a, b] = [year(from), year(to)];
    if (a === b) return { kind: "year", from: a };
    if (from.endsWith("-01-01") && to.endsWith("-12-31") && a % 10 === 0 && b === a + 9) return { kind: "decade", from: a };
    return { kind: "span", from: a, to: b };
  }
  if (from) return { kind: "since", from: year(from) };
  if (to) return { kind: "until", to: year(to) };
  return undefined;
}

function dates(from?: string, to?: string): string | undefined {
  const p = periodOf(from, to);
  switch (p?.kind) {
    case "decade":
      return `from the ${p.from}s`;
    case "year":
      return `from ${p.from}`;
    case "span":
      return `from ${p.from} to ${p.to}`;
    case "since":
      return `from ${p.from} on`;
    case "until":
      return `up to ${p.to}`;
  }
  return undefined;
}

function runtime(min?: number, max?: number): string | undefined {
  if (min !== undefined && max !== undefined) return `${min}–${max} minutes long`;
  if (max !== undefined) return `under ${max} minutes`;
  if (min !== undefined) return `over ${min} minutes`;
  return undefined;
}

export const SORT_WORDS = {
  best_rated: "best rated first",
  most_popular: "most popular first",
  newest: "newest first",
  oldest: "oldest first",
} as const;

/** "Pulled Korean thriller films from 2021 on, best rated first." */
export function describeFilters(f: Filters): string {
  const subject = [
    f.language && languageName(f.language),
    ...f.genres.map((g) => g.name.toLowerCase()),
    f.keywords.length ? f.keywords.map((k) => k.name.toLowerCase()).join("/") : undefined,
  ].filter(Boolean);

  const crew = f.people.filter((p) => p.role === "crew").map((p) => p.name);
  const cast = f.people.filter((p) => p.role === "cast").map((p) => p.name);

  const parts = [
    `Pulled ${subject.length ? `${subject.join(" ")} films` : "films"}`,
    crew.length ? `by ${andList(crew)}` : undefined,
    cast.length ? `with ${andList(cast)}` : undefined,
    dates(f.releasedFrom, f.releasedTo),
    runtime(f.runtimeMin, f.runtimeMax),
    f.minRating !== undefined ? `rated ${f.minRating}+` : undefined,
  ].filter(Boolean);

  return `${parts.join(" ")}, ${SORT_WORDS[f.sort ?? "most_popular"]}.`;
}
