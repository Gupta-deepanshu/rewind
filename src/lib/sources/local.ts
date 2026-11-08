import { DETAILS, STAFF_PICKS } from "../data/details";
import { AISLES, DIRECTORS } from "../data/shelves";
import { slugify } from "../slug";
import type {
  AislePageData,
  AisleShelfData,
  AisleSign,
  AisleSort,
  DecadePageData,
  DirectorShelfData,
  FilmCard,
  FilmDetails,
  FilmPageData,
  NewArrivalsData,
  PersonPageData,
  PickCard,
  SearchItem,
  SearchPerson,
  ShelfData,
} from "../types";

/**
 * The example-data source: used when no TMDB key is set, and as a fallback if TMDB is down.
 */

type LocalFilm = { slug: string; title: string; year: number; directorSlug?: string; details?: FilmDetails };
type LocalDirector = { slug: string; name: string; active: [number, number]; films: string[] };

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
      note: d.staffNote ?? "",
      reason: "Why we picked it",
      starring: d.cast.slice(0, 2).map((c) => c.name),
    };
  });
}

export function localAisles(): AisleShelfData[] {
  return aisles.map((a) => ({
    slug: a.slug,
    num: a.num,
    name: a.name,
    films: a.films.map(card),
    href: a.slug === "new-arrivals" ? "/new" : `/aisles/${a.slug}`,
  }));
}

export function localDirectors(): DirectorShelfData[] {
  return [...directors.values()].map((d) => ({
    slug: d.slug,
    name: d.name,
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
    film: {
      slug: f.slug,
      title: f.title,
      year: f.year,
      directorName: director?.name,
      directorSlug: director?.slug,
      details: f.details,
    },
    aisle: aisle && { slug: aisle.slug, num: aisle.num, name: aisle.name },
    more: source && {
      kicker: source.kicker,
      title: source.title,
      films: source.slugs.filter((s) => s !== slug).map(card),
    },
  };
}

export function localPersonPage(slug: string): PersonPageData | undefined {
  const d = directors.get(slug);
  if (!d) return undefined;
  return {
    slug: d.slug,
    name: d.name,
    knownFor: "Directing",
    shelves: [{ id: "directed", title: "Directed", films: d.films.map(card) }],
  };
}

export const localDirectorSlugs = () => [...directors.keys()];

/* The example store's aisles are its homepage shelves (New Arrivals has its own page). */
const browseAisles = () => aisles.filter((a) => a.slug !== "new-arrivals");

export function localAisleSigns(): AisleSign[] {
  return browseAisles().map((a) => ({ slug: a.slug, num: a.num, name: a.name }));
}

const inDecade = (decade?: number) => (f: { year: number }) => !decade || (f.year >= decade && f.year < decade + 10);

export function localAislePage(slug: string, sort: AisleSort, decade?: number): AislePageData | undefined {
  const a = browseAisles().find((x) => x.slug === slug);
  if (!a) return undefined;
  const films = a.films.map(card).filter(inDecade(decade));
  if (sort === "newest") films.sort((x, y) => y.year - x.year);
  return { aisle: { slug: a.slug, num: a.num, name: a.name }, films, page: 1, totalPages: 1 };
}

export function localAisleIndex(): ShelfData[] {
  return browseAisles().map((a) => ({
    slug: a.slug,
    kicker: `Aisle ${a.num}`,
    title: a.name,
    films: a.films.map(card),
    href: `/aisles/${a.slug}`,
  }));
}

const allCards = () => [...films.keys()].map(card).sort((a, b) => a.year - b.year);

export function localDecadePage(decade: number): DecadePageData {
  const onShelf = allCards().filter(inDecade(decade));
  return {
    decade,
    shelves: onShelf.length
      ? [{ slug: "all", kicker: "On the shelf", title: `Everything from the ${String(decade).slice(2)}s`, films: onShelf }]
      : [],
  };
}

export function localDecadeIndex(decades: number[]): ShelfData[] {
  return decades.map((decade) => ({
    slug: `${decade}s`,
    kicker: `${decade} – ${decade + 9}`,
    title: `The ${decade}s`,
    films: allCards().filter(inDecade(decade)),
    href: `/decades/${decade}s`,
  }));
}

export function localNewArrivals(): NewArrivalsData {
  const shelf = aisles.find((a) => a.slug === "new-arrivals");
  return { nowShowing: shelf ? shelf.films.map(card) : [], comingSoon: [] };
}

export function localAllSlugs(): string[] {
  return [...films.keys()];
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function localSearchPeople(query: string): SearchPerson[] {
  const q = fold(query.trim());
  if (!q) return [];
  return [...directors.values()]
    .filter((d) => fold(d.name).includes(q))
    .slice(0, 4)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      knownFor: "Directing",
      knownTitles: d.films
        .slice(0, 2)
        .map((s) => films.get(s)!.title)
        .join(", "),
    }));
}

export function localRandomFilm(): FilmCard {
  const all = [...films.keys()];
  return card(all[Math.floor(Math.random() * all.length)]);
}

export function localSearch(query: string): SearchItem[] {
  const q = fold(query.trim());
  if (!q) return [];
  return [...films.values()]
    .map((f) => card(f.slug))
    .filter((f) => fold(f.title).includes(q) || (f.directorName && fold(f.directorName).includes(q)))
    .sort((a, b) => Number(!fold(a.title).startsWith(q)) - Number(!fold(b.title).startsWith(q)))
    .slice(0, 8);
}
