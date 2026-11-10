import { languageName, periodOf, SORT_WORDS } from "./comment";
import { omit, type Filters } from "./schema";

/**
 * The filters as chips under the search box, so the customer can see what the clerk understood
 * and take any part of it away. Each chip carries the filters without it; the page links to
 * those, so removing a chip re-runs only the TMDB search.
 */

export type Chip = {
  /** Unique among the chips, stable across renders. */
  key: string;
  /** What the chip shows: "Crime", "1990s", "Under 120 min". */
  label: string;
  /** What kind of filter it is, for screen readers: "Remove genre: Crime". */
  kind: string;
  without: Filters;
};

function periodLabel(f: Filters): string | undefined {
  const p = periodOf(f.releasedFrom, f.releasedTo);
  switch (p?.kind) {
    case "decade":
      return `${p.from}s`;
    case "year":
      return `${p.from}`;
    case "span":
      return `${p.from}–${p.to}`;
    case "since":
      return `${p.from} on`;
    case "until":
      return `Up to ${p.to}`;
  }
  return undefined;
}

function runtimeLabel({ runtimeMin: min, runtimeMax: max }: Filters): string | undefined {
  if (min !== undefined && max !== undefined) return `${min}–${max} min`;
  if (max !== undefined) return `Under ${max} min`;
  if (min !== undefined) return `Over ${min} min`;
  return undefined;
}

const sentence = (s: string) => s[0].toUpperCase() + s.slice(1);

export function chipsFor(f: Filters): Chip[] {
  const chips: Chip[] = [];
  const add = (key: string, kind: string, label: string | undefined, without: () => Filters) => {
    if (label) chips.push({ key, kind, label, without: without() });
  };

  for (const p of f.people) {
    const role = p.role === "cast" ? "With" : "By";
    add(`person-${p.id}`, p.role === "cast" ? "actor" : "filmmaker", `${role} ${p.name}`, () => ({ ...f, people: f.people.filter((x) => x.id !== p.id) }));
  }
  for (const g of f.genres) add(`genre-${g.id}`, "genre", g.name, () => ({ ...f, genres: f.genres.filter((x) => x.id !== g.id) }));
  for (const k of f.keywords) add(`keyword-${k.id}`, "theme", sentence(k.name), () => ({ ...f, keywords: f.keywords.filter((x) => x.id !== k.id) }));

  add("language", "language", f.language && languageName(f.language), () => omit(f, "language"));
  add("dates", "release dates", periodLabel(f), () => omit(f, "releasedFrom", "releasedTo"));
  add("runtime", "running time", runtimeLabel(f), () => omit(f, "runtimeMin", "runtimeMax"));
  add("rating", "rating", f.minRating !== undefined ? `Rated ${f.minRating}+` : undefined, () => omit(f, "minRating"));
  add("votes", "number of votes", f.minVotes !== undefined ? `${f.minVotes.toLocaleString("en")}+ votes` : undefined, () => omit(f, "minVotes"));
  add("sort", "sort order", f.sort && sentence(SORT_WORDS[f.sort]), () => omit(f, "sort"));

  return chips;
}
