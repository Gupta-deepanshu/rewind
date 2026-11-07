import { DIRECTOR_SEEDS } from "./data/seeds";
import { idFromSlug } from "./slug";
import {
  localAisles,
  localAllSlugs,
  localDirectors,
  localFilmPage,
  localSearch,
  localStaffPicks,
} from "./sources/local";
import { tmdbAisles, tmdbConfigured, tmdbDailyPicks, tmdbDirectors, tmdbFilmPage, tmdbSearch } from "./sources/tmdb";
import type { AisleShelfData, DirectorShelfData, FilmPageData, PickCard, SearchItem } from "./types";

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

/** Tapes per aisle: as many as fit across the shelf without one being cut off at the edge. */
const AISLE_TAPES = 23;

export async function getAisles(): Promise<AisleShelfData[]> {
  const aisles = await live("aisles", tmdbAisles, localAisles);
  return aisles.map((a) => ({ ...a, films: a.films.slice(0, AISLE_TAPES) }));
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

export function searchFilms(query: string): Promise<SearchItem[]> {
  return live(
    "search",
    () => tmdbSearch(query),
    () => localSearch(query),
  );
}
