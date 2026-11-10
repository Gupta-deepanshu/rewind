import { askClerk, type ClerkAnswer } from "./ai-search/clerk";
import { interpret, type Interpretation } from "./ai-search/interpret";
import { RateLimiter, TtlCache } from "./ai-search/limits";
import { modelsFromEnv } from "./ai-search/model";
import { decodeFilters } from "./ai-search/url";
import { BOX_SET_SEEDS, DECADES, GENRE_AISLES } from "./data/browse";
import { DIRECTOR_SEEDS } from "./data/seeds";
import { idFromSlug } from "./slug";
import {
  localAisleIndex,
  localAislePage,
  localAisles,
  localAisleSigns,
  localAllSlugs,
  localDecadeIndex,
  localDecadePage,
  localDirectors,
  localDirectorSlugs,
  localFilmPage,
  localNewArrivals,
  localPersonPage,
  localRandomFilm,
  localSearch,
  localSearchPeople,
  localStaffPicks,
} from "./sources/local";
import {
  tmdbAisleIndex,
  tmdbAislePage,
  tmdbAisles,
  tmdbBoxSetPage,
  tmdbBoxSets,
  tmdbConfigured,
  tmdbDailyPicks,
  tmdbDecadeIndex,
  tmdbDecadePage,
  tmdbDirectors,
  tmdbDiscover,
  tmdbFilmPage,
  tmdbFindKeywords,
  tmdbFindPeople,
  tmdbGenreList,
  tmdbNewArrivals,
  tmdbPersonPage,
  tmdbRandomFilm,
  tmdbSearch,
  tmdbSearchBoxSets,
  tmdbSearchPeople,
} from "./sources/tmdb";
import type {
  AislePageData,
  AisleShelfData,
  AisleSign,
  AisleSort,
  BoxSetCard,
  BoxSetPageData,
  DecadePageData,
  DirectorShelfData,
  FilmCard,
  FilmPageData,
  NewArrivalsData,
  PersonPageData,
  PickCard,
  SearchItem,
  SearchResults,
  ShelfData,
} from "./types";
import { spineLook } from "./vhs";

/**
 * The catalog is the only thing pages talk to.
 * With a TMDB key (see .env.example) it serves live data from TMDB; without one, or if TMDB
 * fails, it serves the example data in ./data so the site always works.
 */

export type DataSource = "tmdb" | "example";

export function dataSource(): DataSource {
  return tmdbConfigured() ? "tmdb" : "example";
}

async function live<T>(what: string, fromTmdb: () => Promise<T>, fromExample: () => T): Promise<T> {
  if (!tmdbConfigured()) return fromExample();
  try {
    return await fromTmdb();
  } catch (e) {
    console.error(`[catalog] TMDB failed for ${what}, using example data instead.`, e);
    return fromExample();
  }
}

/** Today's 8 picks: chosen automatically from TMDB each day, or the hand-picked example set. */
export function getTodaysPicks(): Promise<PickCard[]> {
  return live(
    "today's picks",
    async () => {
      const picks = await tmdbDailyPicks();
      if (picks.length === 0) throw new Error("no picks found on TMDB");
      return picks;
    },
    localStaffPicks,
  );
}

/**
 * An aisle holds as many tapes as fit across the shelf without one being cut off at the edge:
 * the room of 23 standard cases. Cases come in slim, standard and wide (see spineLook), so the
 * count varies a little. Widths are in em of the spine row (10px), gap included (6px = 0.6em).
 */
const STANDARD_CASE = 5;
const GAP = 0.6;
const AISLE_ROOM = 23 * (STANDARD_CASE + GAP);

function fillShelf(films: FilmCard[]): FilmCard[] {
  return shelvesOf(films)[0] ?? [];
}

/**
 * Stacks films onto as many full-width shelves as they need, in order (for the aisle and person pages).
 * A last shelf of only a few tapes joins the one above instead (that shelf then scrolls a little),
 * so a page never ends on a nearly empty shelf.
 */
const MIN_LAST_SHELF = 4;

export function shelvesOf<T extends FilmCard>(films: T[]): T[][] {
  const out: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const f of films) {
    const w = spineLook(f.title, f.year).width + GAP;
    if (row.length && used + w > AISLE_ROOM) {
      out.push(row);
      row = [];
      used = 0;
    }
    row.push(f);
    used += w;
  }
  if (row.length) {
    if (out.length && row.length < MIN_LAST_SHELF) out[out.length - 1].push(...row);
    else out.push(row);
  }
  return out;
}

const trimShelves = (shelves: ShelfData[]) => shelves.map((s) => ({ ...s, films: fillShelf(s.films) }));

export async function getAisles(): Promise<AisleShelfData[]> {
  const aisles = await live("aisles", tmdbAisles, localAisles);
  return aisles.map((a) => ({ ...a, films: fillShelf(a.films) }));
}

export function getDirectorShelves(): Promise<DirectorShelfData[]> {
  return live(
    "director shelves",
    async () => {
      const shelves = await tmdbDirectors(DIRECTOR_SEEDS);
      if (shelves.length === 0) throw new Error("no directors found on TMDB");
      return shelves;
    },
    localDirectors,
  );
}

/**
 * A film page. TMDB slugs start with the film's id ("346-seven-samurai"); example-data slugs
 * don't, so links from the example data keep working either way.
 */
export async function getFilmPage(slug: string): Promise<FilmPageData | undefined> {
  const id = idFromSlug(slug);
  if (tmdbConfigured() && id !== undefined) {
    try {
      const page = await tmdbFilmPage(id);
      if (page) return page;
    } catch (e) {
      console.error(`[catalog] TMDB failed for film ${slug}.`, e);
    }
  }
  return localFilmPage(slug);
}

/** Film pages to build ahead of time. Others are built on their first visit. */
export async function getPrebuiltSlugs(): Promise<string[]> {
  if (dataSource() === "tmdb") {
    const picks = await getTodaysPicks();
    return picks.map((p) => p.slug);
  }
  return localAllSlugs();
}

/* ---------- people ---------- */

/** A director's or actor's page. TMDB slugs start with the person's id ("5026-akira-kurosawa"). */
export async function getPersonPage(slug: string): Promise<PersonPageData | undefined> {
  const id = idFromSlug(slug);
  if (tmdbConfigured() && id !== undefined) {
    try {
      const page = await tmdbPersonPage(id);
      if (page) return page;
    } catch (e) {
      console.error(`[catalog] TMDB failed for person ${slug}.`, e);
    }
  }
  return localPersonPage(slug);
}

/** People pages to build ahead of time: the directors on the homepage's director shelf. */
export async function getPrebuiltPeople(): Promise<string[]> {
  if (dataSource() === "tmdb") return (await getDirectorShelves()).map((d) => d.slug);
  return localDirectorSlugs();
}

/* ---------- aisles ---------- */

export function getAisleSigns(): AisleSign[] {
  if (!tmdbConfigured()) return localAisleSigns();
  return GENRE_AISLES.map((g, i) => ({ slug: g.slug, name: g.name, num: String(i + 1).padStart(2, "0") }));
}

/** Every aisle with a shelf of its best films, for the aisles page. */
export async function getAisleIndex(): Promise<ShelfData[]> {
  return trimShelves(await live("aisle index", tmdbAisleIndex, localAisleIndex));
}

export const AISLE_SORTS: { id: AisleSort; label: string }[] = [
  { id: "top", label: "Top rated" },
  { id: "popular", label: "Most popular" },
  { id: "newest", label: "Newest" },
];

export function getAislePage(
  slug: string,
  { sort = "top", decade, page = 1 }: { sort?: AisleSort; decade?: number; page?: number },
): Promise<AislePageData | undefined> {
  return live(
    `aisle ${slug}`,
    () => tmdbAislePage(slug, sort, decade, page),
    () => localAislePage(slug, sort, decade),
  );
}

/* ---------- decades ---------- */

export const getDecades = () => DECADES;

export async function getDecadeIndex(): Promise<ShelfData[]> {
  const shelves = await live("decade index", () => tmdbDecadeIndex(DECADES), () => localDecadeIndex(DECADES));
  return trimShelves(shelves).filter((s) => s.films.length > 0);
}

export async function getDecadePage(decade: number): Promise<DecadePageData> {
  const page = await live(`decade ${decade}`, () => tmdbDecadePage(decade), () => localDecadePage(decade));
  return { ...page, shelves: trimShelves(page.shelves) };
}

/* ---------- box sets ---------- */

/** The box-set wall. The example data has no box sets, so without TMDB it is empty. */
export function getBoxSets(): Promise<BoxSetCard[]> {
  return live("box sets", tmdbBoxSets, () => []);
}

export async function getBoxSetPage(slug: string): Promise<BoxSetPageData | undefined> {
  const id = idFromSlug(slug);
  if (!tmdbConfigured() || id === undefined) return undefined;
  try {
    return await tmdbBoxSetPage(id);
  } catch (e) {
    console.error(`[catalog] TMDB failed for box set ${slug}.`, e);
    return undefined;
  }
}

/** Box-set pages to build ahead of time: the ones on the wall. */
export async function getPrebuiltBoxSets(): Promise<string[]> {
  const sets = await getBoxSets();
  // with no box sets (example data) one placeholder keeps the route buildable; it renders as not found
  return sets.length ? sets.map((s) => s.slug) : [`${BOX_SET_SEEDS[0].id}`];
}

/* ---------- new arrivals ---------- */

export function getNewArrivals(): Promise<NewArrivalsData> {
  return live("new arrivals", tmdbNewArrivals, localNewArrivals);
}

/** Films, people and box sets matching a search, all at once. */
export async function searchAll(query: string): Promise<SearchResults> {
  const [films, people, boxSets] = await Promise.all([
    searchFilms(query),
    live("people search", () => tmdbSearchPeople(query), () => localSearchPeople(query)),
    // the example data has no box sets
    live("box set search", () => tmdbSearchBoxSets(query), () => []),
  ]);
  return { films, people, boxSets };
}

/** A random well-rated film, for "Surprise me". */
export async function getRandomFilm(): Promise<FilmCard> {
  return live(
    "random film",
    async () => (await tmdbRandomFilm()) ?? localRandomFilm(),
    localRandomFilm,
  );
}

export function searchFilms(query: string): Promise<SearchItem[]> {
  return live(
    "search",
    () => tmdbSearch(query),
    () => localSearch(query),
  );
}

/* ---------- ask the clerk (AI search) ---------- */

/** Each visitor may make this many model calls a minute; cached answers don't count. */
const CLERK_CALLS_PER_MINUTE = 10;
/** How long an interpretation of the same words is reused. */
const CLERK_CACHE_MS = 10 * 60_000;

// per server instance: see "Known limitations" in the README
const clerkLimiter = new RateLimiter(CLERK_CALLS_PER_MINUTE, 60_000);
const clerkCache = new TtlCache<Interpretation>(CLERK_CACHE_MS);

/**
 * The clerk's answer for a request. `f` is the `f=` URL parameter: filters already worked out,
 * so the model isn't asked again. `visitor` identifies the asker for the rate limit (their IP).
 */
export function askTheClerk(query: string, f: string | undefined, visitor: string): Promise<ClerkAnswer> {
  const today = new Date().toISOString().slice(0, 10);
  // every configured provider, in order: the next is asked when one is out of quota or down
  const models = modelsFromEnv();
  return askClerk(query, decodeFilters(f), {
    today,
    visitor,
    canDiscover: tmdbConfigured(),
    limiter: clerkLimiter,
    cache: clerkCache,
    interpret: (q) =>
      interpret(q, {
        models,
        today,
        lookups: { genres: tmdbGenreList, people: (name) => tmdbFindPeople(name), keywords: (term) => tmdbFindKeywords(term) },
      }),
    discover: (params) => tmdbDiscover(params),
    titleSearch: searchFilms,
  });
}
