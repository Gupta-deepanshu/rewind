import { emptyFilters, isEmpty, type Filters, type Genre } from "./schema";

/**
 * The fallback when the model is unavailable (no key, rate-limited, down, too slow): a small
 * rule-based parser for the common shapes of a film request. It understands decades, years,
 * "the last N years", runtimes, ratings, genre words, nationalities and sort words. It doesn't
 * know people or themes; those need the model's lookups.
 *
 * Genre ids are TMDB's, which never change (see src/lib/data/browse.ts).
 */

const GENRE_WORDS: [RegExp, Genre][] = [
  [/\baction\b/, { id: 28, name: "Action" }],
  [/\badventures?\b/, { id: 12, name: "Adventure" }],
  [/\b(animated|animation|cartoons?|anime)\b/, { id: 16, name: "Animation" }],
  [/\b(comed(y|ies)|funny|rom-?coms?)\b/, { id: 35, name: "Comedy" }],
  [/\bcrime\b/, { id: 80, name: "Crime" }],
  [/\b(documentar(y|ies)|docs)\b/, { id: 99, name: "Documentary" }],
  [/\bdramas?\b/, { id: 18, name: "Drama" }],
  [/\b(family|kids'?|children'?s)\b/, { id: 10751, name: "Family" }],
  [/\bfantasy\b/, { id: 14, name: "Fantasy" }],
  [/\b(history|historical)\b/, { id: 36, name: "History" }],
  [/\b(horror|scary)\b/, { id: 27, name: "Horror" }],
  [/\bmusicals?\b/, { id: 10402, name: "Music" }],
  [/\bmyster(y|ies)\b/, { id: 9648, name: "Mystery" }],
  [/\b(romance|romantic|rom-?coms?)\b/, { id: 10749, name: "Romance" }],
  [/\b(sci-?fi|science[- ]fiction)\b/, { id: 878, name: "Science Fiction" }],
  [/\bthrillers?\b/, { id: 53, name: "Thriller" }],
  [/\bwar\b/, { id: 10752, name: "War" }],
  [/\bwesterns?\b/, { id: 37, name: "Western" }],
];

const LANGUAGE_WORDS: [RegExp, string][] = [
  [/\b(south )?korean\b/, "ko"],
  [/\bjapanese\b/, "ja"],
  [/\bfrench\b/, "fr"],
  [/\bspanish\b/, "es"],
  [/\bitalian\b/, "it"],
  [/\bgerman\b/, "de"],
  [/\b(hindi|bollywood)\b/, "hi"],
  [/\b(mandarin|chinese)\b/, "zh"],
  [/\bcantonese\b/, "cn"],
  [/\bswedish\b/, "sv"],
  [/\bdanish\b/, "da"],
  [/\bnorwegian\b/, "no"],
  [/\brussian\b/, "ru"],
  [/\b(iranian|persian)\b/, "fa"],
  [/\bturkish\b/, "tr"],
  [/\b(tamil|kollywood)\b/, "ta"],
  [/\b(telugu|tollywood)\b/, "te"],
  [/\bmalayalam\b/, "ml"],
  [/\bthai\b/, "th"],
  [/\b(portuguese|brazilian)\b/, "pt"],
  [/\bpolish\b/, "pl"],
];

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20 };
const num = (s: string) => NUMBER_WORDS[s] ?? Number(s);
const NUM = String.raw`(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|twenty)`;

/** "90s" → 1990, "1990s" → 1990, "00s" → 2000, "10s" → 2010, "20s" → 1920 (as on the decade shelves). */
function decadeOf(q: string): number | undefined {
  const m = /(?:^|[^\d])(?:(19|20)(\d)0|'?(\d)0)'?s\b/.exec(q);
  if (!m) return undefined;
  if (m[1]) return Number(`${m[1]}${m[2]}0`);
  const d = Number(m[3]);
  return d <= 1 ? 2000 + d * 10 : 1900 + d * 10;
}

const yearsBefore = (today: string, n: number) => `${Number(today.slice(0, 4)) - n}${today.slice(4)}`;

function datesOf(q: string, today: string): Pick<Filters, "releasedFrom" | "releasedTo"> {
  const last = new RegExp(String.raw`\b(?:last|past)\s+${NUM}\s+years?\b`).exec(q);
  if (last) return { releasedFrom: yearsBefore(today, num(last[1])), releasedTo: today };
  if (/\b(this year)\b/.test(q)) return { releasedFrom: `${today.slice(0, 4)}-01-01`, releasedTo: today };

  const decade = decadeOf(q);
  if (decade) return { releasedFrom: `${decade}-01-01`, releasedTo: `${decade + 9}-12-31` };

  const range = /\b(?:from|between)\s+((?:19|20)\d\d)\s*(?:to|and|-|–)\s*((?:19|20)\d\d)\b/.exec(q);
  if (range && range[1] <= range[2]) return { releasedFrom: `${range[1]}-01-01`, releasedTo: `${range[2]}-12-31` };

  const out: Pick<Filters, "releasedFrom" | "releasedTo"> = {};
  // "from 1998" alone means that year; "from 1998 on" means since
  const after = /\b(after|since)\s+((?:19|20)\d\d)\b|\b(from)\s+((?:19|20)\d\d)\s+(?:on|onwards?|and (?:later|after))\b/.exec(q);
  const before = /\b(before|until|up to|pre)[- ]((?:19|20)\d\d)\b|\bbefore\s+((?:19|20)\d\d)\b/.exec(q);
  if (after) out.releasedFrom = `${Number(after[2] ?? after[4]) + (after[1] === "after" ? 1 : 0)}-01-01`;
  if (before) {
    const y = Number(before[2] ?? before[3]);
    out.releasedTo = before[1] === "until" || before[1] === "up to" ? `${y}-12-31` : `${y - 1}-12-31`;
  }
  if (!after && !before) {
    const single = /\b(?:in|from)?\s*((?:19|20)\d\d)\b/.exec(q);
    if (single) return { releasedFrom: `${single[1]}-01-01`, releasedTo: `${single[1]}-12-31` };
  }
  return out;
}

function runtimeOf(q: string): Pick<Filters, "runtimeMin" | "runtimeMax"> {
  const unit = String.raw`\s*(hours?|hrs?|h|minutes?|mins?|m)\b`;
  const minutes = (n: string, u: string) => Math.round(num(n) * (u.startsWith("h") ? 60 : 1));
  const out: Pick<Filters, "runtimeMin" | "runtimeMax"> = {};
  const under = new RegExp(String.raw`\b(?:under|less than|shorter than|below|at most|max(?:imum)?|no (?:more|longer) than)\s+${NUM}${unit}`).exec(q);
  const over = new RegExp(String.raw`\b(?:over|more than|longer than|at least)\s+${NUM}${unit}`).exec(q);
  if (under) out.runtimeMax = minutes(under[1], under[2]);
  if (over) out.runtimeMin = minutes(over[1], over[2]);
  return out;
}

function ratingOf(q: string): number | undefined {
  const m =
    /\b(?:rated|rating|score[sd]?)\s*(?:of\s+|above\s+|over\s+|at least\s+|higher than\s+|>=?\s*)?(\d{1,2}(?:\.\d)?)\s*\+?/.exec(q) ??
    /\b(?:above|over|at least)\s+(\d(?:\.\d)?)\s*(?:\/\s*10\s*)?(?:rating|rated|stars?)\b/.exec(q) ??
    /\b(\d(?:\.\d)?)\s*\+\s*(?:rating|rated)?/.exec(q);
  const n = m ? Number(m[1]) : NaN;
  return n >= 0 && n <= 10 ? n : undefined;
}

function sortOf(q: string): Filters["sort"] {
  if (/\b(best|top|top-rated|highest[- ]rated|highly[- ]rated|greatest|acclaimed|masterpieces?)\b/.test(q)) return "best_rated";
  if (/\b(newest|latest|recent|new)\b/.test(q)) return "newest";
  if (/\b(oldest|earliest)\b/.test(q)) return "oldest";
  if (/\b(popular|trending)\b/.test(q)) return "most_popular";
  return undefined;
}

/** What the rules could make of a request. `understood` is false when nothing matched at all. */
export function parseWithRules(query: string, today: string): { filters: Filters; understood: boolean } {
  const q = query.toLowerCase();
  const filters = emptyFilters();

  for (const [re, genre] of GENRE_WORDS) {
    if (re.test(q) && !filters.genres.some((g) => g.id === genre.id)) filters.genres.push(genre);
  }
  filters.genres = filters.genres.slice(0, 3);

  const language = LANGUAGE_WORDS.find(([re]) => re.test(q))?.[1];
  if (language) filters.language = language;

  Object.assign(filters, datesOf(q, today), runtimeOf(q));
  const rating = ratingOf(q);
  if (rating !== undefined) filters.minRating = rating;
  const sort = sortOf(q);
  if (sort) filters.sort = sort;

  return { filters, understood: !isEmpty(filters) || sort !== undefined };
}
