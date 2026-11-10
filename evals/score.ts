import type { Interpretation } from "../src/lib/ai-search/interpret";
import type { Expected } from "./cases";

/**
 * Compares the clerk's interpretation with what a case expects. Each checked field gets its own
 * pass/fail, so the report can say which kinds of filter the model gets wrong.
 */

export type FieldResult = { field: string; ok: boolean; got: string; want: string };

const lower = (s: string) => s.toLowerCase();
const year = (d?: string) => (d ? Number(d.slice(0, 4)) : undefined);
const show = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

export function intentOf(i: Interpretation): Expected["intent"] | "fallback" {
  if (i.kind === "off_topic") return "off_topic";
  if (i.kind === "fallback") return "fallback";
  return i.vague ? "vague" : "search";
}

export function score(i: Interpretation, want: Expected, today: string): FieldResult[] {
  const out: FieldResult[] = [];
  const check = (field: string, ok: boolean, got: unknown, wanted: unknown) => out.push({ field, ok, got: show(got), want: show(wanted) });

  const intent = intentOf(i);
  check("intent", intent === want.intent, intent, want.intent);
  // off-topic and vague requests are judged on their intent alone
  if (i.kind !== "ok" || want.intent !== "search") return out;
  const f = i.filters;

  if (want.genres) {
    const names = f.genres.map((g) => lower(g.name));
    check("genres", want.genres.every((g) => names.includes(lower(g))), f.genres.map((g) => g.name), want.genres);
  }
  if (want.notGenres) {
    const names = f.genres.map((g) => lower(g.name));
    check("genres (excluded)", !want.notGenres.some((g) => names.includes(lower(g))), f.genres.map((g) => g.name), `none of ${want.notGenres.join(", ")}`);
  }
  if (want.keywords) {
    const names = f.keywords.map((k) => lower(k.name));
    check("keywords", want.keywords.every((w) => names.some((n) => n.includes(lower(w)))), f.keywords.map((k) => k.name), want.keywords);
  }
  if (want.people) {
    const ok = want.people.every((p) => f.people.some((x) => lower(x.name) === lower(p.name) && x.role === p.role));
    check("people", ok, f.people.map((p) => `${p.name} (${p.role})`), want.people.map((p) => `${p.name} (${p.role})`));
  }
  if (want.fromYear !== undefined) {
    // "the last five years" can fairly start in either of two calendar years
    const got = year(f.releasedFrom);
    check("from year", got !== undefined && Math.abs(got - want.fromYear) <= (want.toYear === "today" ? 1 : 0), got, want.fromYear);
  }
  if (want.toYear !== undefined) {
    const wantYear = want.toYear === "today" ? year(today) : want.toYear;
    // no end date means "until today" too: the search never shows unreleased films
    const ok = year(f.releasedTo) === wantYear || (want.toYear === "today" && f.releasedTo === undefined);
    check("to year", ok, year(f.releasedTo), wantYear);
  }
  if (want.runtimeMin !== undefined) check("runtime min", f.runtimeMin === want.runtimeMin, f.runtimeMin, want.runtimeMin);
  if (want.runtimeMax !== undefined) check("runtime max", f.runtimeMax === want.runtimeMax, f.runtimeMax, want.runtimeMax);
  if (want.minRating !== undefined) check("min rating", f.minRating === want.minRating, f.minRating, want.minRating);
  if (want.minVotes !== undefined) check("min votes", f.minVotes === want.minVotes, f.minVotes, want.minVotes);
  if (want.language !== undefined) check("language", f.language === want.language, f.language, want.language);
  if (want.sort !== undefined) check("sort", f.sort === want.sort, f.sort, want.sort);
  return out;
}
