import { DETAILS, STAFF_PICKS } from "../data/details";
import { AISLES, DIRECTORS } from "../data/shelves";
import { slugify } from "../slug";
import type {
  AisleShelfData,
  DirectorShelfData,
  FilmCard,
  FilmDetails,
  FilmPageData,
  PickCard,
  SearchItem,
} from "../types";

/**
 * The example-data source: used when no TMDB key is set, and as a fallback if TMDB is down.
 */

type LocalFilm = { slug: string; title: string; year: number; directorSlug?: string; details?: FilmDetails };
type LocalDirector = { slug: string; name: string; nativeName?: string; active: [number, number]; films: string[] };

const films = new Map<string, LocalFilm>();
const directors = new Map<string, LocalDirector>();

function addFilm(title: string, year: number, directorSlug?: string): string {
  const slug = slugify(title);
  const existing = films.get(slug);
  if (existing) {
    if (directorSlug && !existing.directorSlug) existing.directorSlug = directorSlug;
    return slug;
  }
  films.set(slug, { slug, title, year, directorSlug, details: DETAILS[slug] });
  return slug;
}

for (const d of DIRECTORS) {
  directors.set(d.slug, { ...d, films: d.films.map(([title, year]) => addFilm(title, year, d.slug)) });
}
const aisles = AISLES.map((a) => ({ ...a, films: a.films.map(([title, year]) => addFilm(title, year)) }));
for (const slug of STAFF_PICKS) {
  if (!films.has(slug)) throw new Error(`Staff pick "${slug}" is not on any shelf`);
}

const directorName = (f: LocalFilm) => (f.directorSlug ? directors.get(f.directorSlug)?.name : undefined);

const card = (slug: string): FilmCard => {
  const f = films.get(slug)!;
  return { slug: f.slug, title: f.title, year: f.year, directorName: directorName(f) };
};

export function localStaffPicks(): PickCard[] {
  return STAFF_PICKS.map((slug) => {
    const d = films.get(slug)!.details!;
    return {
      ...card(slug),
      originalTitle: d.originalTitle,
      runtime: d.runtime,
      genres: d.genres,
      synopsis: d.synopsis,
      staffNote: d.staffNote ?? "",
      starring: d.cast.slice(0, 2).map((c) => c.name),
    };
  });
}

/** Title, year and note for each staff pick, so the TMDB source can look them up. */
export function localStaffSeeds(): { title: string; year: number; staffNote: string }[] {
  return STAFF_PICKS.map((slug) => {
    const f = films.get(slug)!;
    return { title: f.title, year: f.year, staffNote: f.details?.staffNote ?? "" };
  });
}

export function localAisles(): AisleShelfData[] {
  return aisles.map((a) => ({ slug: a.slug, num: a.num, name: a.name, jp: a.jp, films: a.films.map(card) }));
}

export function localDirectors(): DirectorShelfData[] {
  return [...directors.values()].map((d) => ({
    slug: d.slug,
    name: d.name,
    nativeName: d.nativeName,
    active: d.active,
    films: d.films.map(card),
  }));
}

export function localFilmPage(slug: string): FilmPageData | undefined {
  const f = films.get(slug);
  if (!f) return undefined;
  const director = f.directorSlug ? directors.get(f.directorSlug) : undefined;
  const aisle = aisles.find((a) => a.films.includes(slug));
  const source = director
    ? { kicker: "Director shelf", title: `More from ${director.name}`, slugs: director.films }
    : aisle
      ? { kicker: `Aisle ${aisle.num}`, title: `More in ${aisle.name}`, slugs: aisle.films }
      : undefined;
  return {
    film: { slug: f.slug, title: f.title, year: f.year, directorName: director?.name, details: f.details },
    aisle: aisle && { slug: aisle.slug, num: aisle.num, name: aisle.name },
    more: source && {
      kicker: source.kicker,
      title: source.title,
      films: source.slugs.filter((s) => s !== slug).map(card),
    },
  };
}

export function localAllSlugs(): string[] {
  return [...films.keys()];
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function localSearch(query: string): SearchItem[] {
  const q = fold(query.trim());
  if (!q) return [];
  return [...films.values()]
    .map((f) => card(f.slug))
    .filter((f) => fold(f.title).includes(q) || (f.directorName && fold(f.directorName).includes(q)))
    .sort((a, b) => Number(!fold(a.title).startsWith(q)) - Number(!fold(b.title).startsWith(q)))
    .slice(0, 8);
}
