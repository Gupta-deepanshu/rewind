import { cacheLife } from "next/cache";
import { BOX_SET_SEEDS, DECADE_GENRES, GENRE_AISLES, genreAisleById, genreAisleBySlug } from "../data/browse";
import type { PersonCandidate } from "../ai-search/tools";
import { tmdbSlug } from "../slug";
import type {
  AisleShelfData,
  AislePageData,
  AisleSort,
  ArrivalCard,
  BoxSetCard,
  BoxSetPageData,
  CastMember,
  CreditCard,
  DecadePageData,
  CrewMember,
  DirectorShelfData,
  Film,
  FilmCard,
  FilmPageData,
  NewArrivalsData,
  PersonPageData,
  PickCard,
  SearchBoxSet,
  SearchItem,
  SearchPerson,
  ShelfData,
} from "../types";

/**
 * The live source: The Movie Database (TMDB).
 * Every request is cached with `use cache`, so each page only calls TMDB when its cache expires.
 *
 * api.tmdb.org is TMDB's alternative host. It is used by default because api.themoviedb.org
 * is blocked by some internet providers. Override it with TMDB_API_BASE.
 */
const BASE = process.env.TMDB_API_BASE ?? "https://api.tmdb.org/3";
/** Whose cinema listings "now showing" and "coming soon" follow (ISO 3166-1 country code). */
const REGION = process.env.TMDB_REGION ?? "US";
const IMG = "https://image.tmdb.org/t/p";

export const tmdbConfigured = () => Boolean(process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY);

export class TmdbNotFound extends Error {}

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { accept: "application/json" };
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  else url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");

  const started = Date.now();
  const res = await fetch(url, { headers });
  if (process.env.NODE_ENV === "development") {
    // Shows each real TMDB call in the terminal running `npm run dev`. Cached answers don't call TMDB, so they don't print.
    console.log(`[tmdb] ${res.status} ${path} (${Date.now() - started}ms)`);
  }
  if (res.status === 404) throw new TmdbNotFound(path);
  if (!res.ok) throw new Error(`TMDB ${path} answered ${res.status}`);
  return (await res.json()) as T;
}

/* ---------- raw TMDB shapes (only the fields we use) ---------- */

type RawMovie = {
  id: number;
  title: string;
  release_date?: string;
  vote_count?: number;
  poster_path?: string | null;
};

/** Poster URL at a size that stays sharp on the film page's big box on retina screens. */
const posterUrl = (m: RawMovie) => (m.poster_path ? `${IMG}/w500${m.poster_path}` : undefined);

type RawPage = { results: RawMovie[]; total_pages?: number };

type RawDetails = RawMovie & {
  original_title: string;
  original_language: string;
  overview: string;
  tagline: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  belongs_to_collection: { id: number; name: string } | null;
  vote_average: number;
  vote_count: number;
  production_companies: { name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string }[];
  credits: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string; department: string }[];
  };
  videos: { results: { key: string; site: string; type: string; official: boolean }[] };
  images: { backdrops: { file_path: string }[] };
  recommendations: RawPage;
};

type RawCredit = RawMovie & { character?: string; job?: string; department?: string };

type RawPerson = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  movie_credits: { cast: RawCredit[]; crew: (RawCredit & { job: string })[] };
};

type RawCollection = { id: number; name: string; overview: string; poster_path: string | null; parts: RawMovie[] };

/* ---------- cached requests ---------- */

/** A film with credits, videos, images and recommendations, or null if TMDB has no such film. */
async function movieOrNull(id: number): Promise<RawDetails | null> {
  "use cache";
  cacheLife("days");
  try {
    return await tmdb<RawDetails>(`/movie/${id}`, {
      language: "en-US",
      append_to_response: "credits,videos,images,recommendations",
      include_image_language: "en,null",
    });
  } catch (e) {
    if (e instanceof TmdbNotFound) return null;
    throw e;
  }
}


async function list(path: string, params: Record<string, string | number>): Promise<RawMovie[]> {
  "use cache";
  cacheLife("hours");
  const page = await tmdb<RawPage>(path, { language: "en-US", include_adult: "false", ...params });
  return page.results;
}

async function findDirectorId(name: string): Promise<number | undefined> {
  "use cache";
  cacheLife("weeks");
  const page = await tmdb<{ results: { id: number; known_for_department: string }[] }>("/search/person", {
    query: name,
    include_adult: "false",
  });
  return (page.results.find((p) => p.known_for_department === "Directing") ?? page.results[0])?.id;
}

/**
 * A person with their film credits, or null if TMDB has no such person. The not-found check
 * happens inside the cached function: an error thrown out of "use cache" loses its class.
 */
async function personOrNull(id: number): Promise<RawPerson | null> {
  "use cache";
  cacheLife("days");
  try {
    return await tmdb<RawPerson>(`/person/${id}`, { language: "en-US", append_to_response: "movie_credits" });
  } catch (e) {
    if (e instanceof TmdbNotFound) return null;
    throw e;
  }
}

/** One page of a list, with how many pages there are (discover answers at most 500). */
async function listPage(path: string, params: Record<string, string | number>): Promise<Required<RawPage>> {
  "use cache";
  cacheLife("hours");
  const page = await tmdb<RawPage>(path, { language: "en-US", include_adult: "false", ...params });
  return { results: page.results, total_pages: Math.min(page.total_pages ?? 1, 500) };
}

async function collectionOrNull(id: number): Promise<RawCollection | null> {
  "use cache";
  cacheLife("days");
  try {
    return await tmdb<RawCollection>(`/collection/${id}`, { language: "en-US" });
  } catch (e) {
    if (e instanceof TmdbNotFound) return null;
    throw e;
  }
}

async function searchMovies(query: string): Promise<RawMovie[]> {
  "use cache";
  cacheLife("hours");
  const page = await tmdb<RawPage>("/search/movie", { query, include_adult: "false", language: "en-US" });
  return page.results;
}

/* ---------- mapping ---------- */

const yearOf = (m: RawMovie) => Number(m.release_date?.slice(0, 4)) || 0;

const toCard = (m: RawMovie, directorName?: string): FilmCard => ({
  slug: tmdbSlug(m.id, m.title),
  title: m.title,
  year: yearOf(m),
  directorName,
  poster: posterUrl(m),
});

const cards = (movies: RawMovie[]) => movies.filter((m) => yearOf(m) > 0).map((m) => toCard(m));

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** A short synopsis for the top of the page: the first sentence or two. */
function shortSynopsis(text: string, max = 220): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).length > max) break;
    out += s;
  }
  return out.trim() || text;
}

const CREW_JOBS: [job: string, label: string][] = [
  ["Producer", "Produced by"],
  ["Original Music Composer", "Music"],
  ["Director of Photography", "Cinematography"],
  ["Editor", "Edited by"],
];

function directorsOf(m: RawDetails) {
  return m.credits.crew.filter((c) => c.job === "Director");
}

function toFilm(m: RawDetails, staffNote?: string): Film {
  const crew = m.credits.crew;
  const directors = directorsOf(m);
  const writers = unique(crew.filter((c) => c.department === "Writing").map((c) => c.name)).slice(0, 4);
  const crewRows: CrewMember[] = CREW_JOBS.flatMap(([job, label]) => {
    const names = unique(crew.filter((c) => c.job === job).map((c) => c.name)).slice(0, 2);
    return names.length ? [{ job: label, name: names.join(", ") }] : [];
  });
  const cast: CastMember[] = m.credits.cast.slice(0, 8).map((c) => ({
    name: c.name,
    character: c.character || "Unnamed role",
    photo: c.profile_path ? `${IMG}/w185${c.profile_path}` : undefined,
    slug: tmdbSlug(c.id, c.name),
  }));
  const trailers = m.videos.results.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const trailer = trailers.find((v) => v.official) ?? trailers[0];
  const language =
    m.spoken_languages.find((l) => l.iso_639_1 === m.original_language)?.english_name ??
    m.spoken_languages[0]?.english_name ??
    m.original_language.toUpperCase();

  return {
    slug: tmdbSlug(m.id, m.title),
    title: m.title,
    year: yearOf(m),
    directorName: directors.map((d) => d.name).join(" & ") || undefined,
    directorSlug: directors[0] && tmdbSlug(directors[0].id, directors[0].name),
    poster: posterUrl(m),
    boxSet: m.belongs_to_collection
      ? { slug: boxSetSlug(m.belongs_to_collection), name: boxSetName(m.belongs_to_collection) }
      : undefined,
    aisles: m.genres.flatMap((g) => {
      const aisle = genreAisleById(g.id);
      return aisle ? [{ slug: aisle.slug, name: aisle.name }] : [];
    }),
    details: {
      originalTitle: m.original_title && m.original_title !== m.title ? m.original_title : undefined,
      runtime: m.runtime ?? 0,
      genres: m.genres.map((g) => g.name),
      language,
      synopsis: shortSynopsis(m.overview),
      tagline: m.tagline,
      backCopy: m.overview,
      staffNote,
      writers,
      studio: m.production_companies[0]?.name ?? "",
      cast,
      crew: crewRows,
      rating: m.vote_count > 0 ? Math.round(m.vote_average * 10) / 10 : undefined,
      voteCount: m.vote_count,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
      stills: m.images.backdrops.slice(0, 3).map((b) => `${IMG}/w780${b.file_path}`),
    },
  };
}

/** A director's feature films, oldest first. Very obscure credits (shorts, TV bits) are left out. */
async function directed(personId: number): Promise<{ name: string; films: FilmCard[] }> {
  const p = await personOrNull(personId);
  if (!p) return { name: "", films: [] };
  const seen = new Set<number>();
  const films = p.movie_credits.crew
    .filter((c) => c.job === "Director" && yearOf(c) > 0 && (c.vote_count ?? 0) >= 15)
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""))
    .map((c) => toCard(c, p.name));
  return { name: p.name, films };
}

/* ---------- what the catalog asks for ---------- */

/** A small seeded random number generator (mulberry32): the same seed gives the same sequence. */
function seededRandom(seed: string): () => number {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a, 31) + seed.charCodeAt(i)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TOP_RATED_PICKS = 5;
const TRENDING_PICKS = 3;
const TOP_RATED_PAGES = 25; // the top 500 films

/**
 * Today's picks, chosen automatically: 5 from TMDB's top-rated films (spread across decades)
 * and 3 from this week's trending films.
 *
 * The date seeds the random choice, so everyone sees the same 8 films all day. The result is
 * cached for an hour; after midnight (UTC) the next refresh picks a new set.
 */
export async function tmdbDailyPicks(): Promise<PickCard[]> {
  "use cache";
  cacheLife("hours");

  const day = new Date().toISOString().slice(0, 10);
  const rand = seededRandom(day);
  const pageA = 1 + Math.floor(rand() * TOP_RATED_PAGES);
  const pageB = 1 + ((pageA + Math.floor(rand() * (TOP_RATED_PAGES - 1))) % TOP_RATED_PAGES);

  const [topA, topB, trending] = await Promise.all([
    list("/movie/top_rated", { page: pageA }),
    list("/movie/top_rated", { page: pageB }),
    list("/trending/movie/week", {}),
  ]);

  // top-rated: prefer one film per decade so the shelf mixes eras
  const chosen: { movie: RawMovie; from: "top" | "trending" }[] = [];
  const taken = new Set<number>();
  const decades = new Set<number>();
  const topPool = shuffle([...topA, ...topB], rand).filter((m) => yearOf(m) > 0);
  for (const pass of [true, false]) {
    for (const m of topPool) {
      if (chosen.length >= TOP_RATED_PICKS) break;
      const decade = Math.floor(yearOf(m) / 10) * 10;
      if (taken.has(m.id) || (pass && decades.has(decade))) continue;
      chosen.push({ movie: m, from: "top" });
      taken.add(m.id);
      decades.add(decade);
    }
  }
  // trending: only films that are out and have some votes
  for (const m of shuffle(trending, rand)) {
    if (chosen.length >= TOP_RATED_PICKS + TRENDING_PICKS) break;
    if (taken.has(m.id) || yearOf(m) === 0 || (m.vote_count ?? 0) < 50) continue;
    chosen.push({ movie: m, from: "trending" });
    taken.add(m.id);
  }

  const picks = await Promise.all(
    shuffle(chosen, rand).map(async ({ movie: m, from }): Promise<PickCard | undefined> => {
      const raw = await movieOrNull(m.id);
      if (!raw) return undefined;
      const film = toFilm(raw);
      const d = film.details!;
      const votes = d.voteCount ? `${d.voteCount.toLocaleString("en")} viewers` : "";
      const rated = d.rating !== undefined && votes ? `rated ${d.rating.toFixed(1)} / 10 by ${votes}` : "";
      const reason =
        from === "trending"
          ? ["Trending this week", rated].filter(Boolean).join(" · ")
          : [rated && rated[0].toUpperCase() + rated.slice(1), `one of the best-loved films of the ${Math.floor(film.year / 10) * 10}s`]
              .filter(Boolean)
              .join(" · ");
      return {
        slug: film.slug,
        title: film.title,
        year: film.year,
        directorName: film.directorName,
        poster: film.poster,
        originalTitle: d.originalTitle,
        runtime: d.runtime,
        genres: d.genres,
        synopsis: d.synopsis,
        note: d.tagline,
        reason,
        starring: d.cast.slice(0, 2).map((c) => c.name),
      };
    }),
  );
  return picks.filter((p): p is PickCard => Boolean(p));
}

/** A TMDB page holds only 20 films, so each shelf reads two pages; the catalog trims it to fit. */
async function shelf(path: string, params: Record<string, string | number>) {
  const pages = await Promise.all([1, 2].map((page) => list(path, { ...params, page })));
  const seen = new Set<number>();
  const movies = pages.flat().filter((m) => !seen.has(m.id) && Boolean(seen.add(m.id)));
  return cards(movies);
}

export async function tmdbAisles(): Promise<AisleShelfData[]> {
  const topRated = { sort_by: "vote_average.desc", "vote_count.gte": 2500 };
  const [now, drama, thriller] = await Promise.all([
    shelf("/movie/now_playing", {}),
    shelf("/discover/movie", { ...topRated, with_genres: "18" }),
    shelf("/discover/movie", { ...topRated, with_genres: "53|9648" }),
  ]);
  return [
    { slug: "new-arrivals", num: "01", name: "New Arrivals", films: now, href: "/new" },
    { slug: "drama", num: "02", name: "Drama", films: drama, href: "/aisles/drama" },
    { slug: "thriller-mystery", num: "03", name: "Thriller & Mystery", films: thriller, href: "/aisles/thriller" },
  ];
}

export async function tmdbDirectors(seeds: { name: string }[]): Promise<DirectorShelfData[]> {
  const shelves = await Promise.all(
    seeds.map(async (seed): Promise<DirectorShelfData | undefined> => {
      const id = await findDirectorId(seed.name);
      if (!id) return undefined;
      const { name, films } = await directed(id);
      if (films.length === 0) return undefined;
      return {
        slug: tmdbSlug(id, name),
        name,
        active: [films[0].year, films[films.length - 1].year],
        films,
      };
    }),
  );
  return shelves.filter((s): s is DirectorShelfData => Boolean(s));
}

export async function tmdbFilmPage(id: number): Promise<FilmPageData | undefined> {
  const raw = await movieOrNull(id);
  if (!raw) return undefined;
  const film = toFilm(raw);
  const director = directorsOf(raw)[0];
  if (director) {
    const { name, films } = await directed(director.id);
    const others = films.filter((f) => f.slug !== film.slug);
    if (others.length) return { film, more: { kicker: "Director shelf", title: `More from ${name}`, films: others } };
  }
  const recs = cards(raw.recommendations.results);
  return { film, more: recs.length ? { kicker: "On the next shelf", title: "More like this", films: recs } : undefined };
}

type RawPersonHit = {
  id: number;
  name: string;
  known_for_department: string;
  popularity: number;
  known_for?: { title?: string; media_type: string }[];
};

async function searchPeople(query: string): Promise<RawPersonHit[]> {
  "use cache";
  cacheLife("hours");
  const page = await tmdb<{ results: RawPersonHit[] }>("/search/person", { query, include_adult: "false", language: "en-US" });
  return page.results;
}

async function searchCollections(query: string): Promise<{ id: number; name: string }[]> {
  "use cache";
  cacheLife("hours");
  const page = await tmdb<{ results: { id: number; name: string }[] }>("/search/collection", { query, language: "en-US" });
  return page.results;
}

/** Below this TMDB popularity a name match is usually a namesake nobody is looking for. */
const MIN_PERSON_POPULARITY = 0.5;

/** People whose name matches, best known first. Only people known for some films. */
export async function tmdbSearchPeople(query: string): Promise<SearchPerson[]> {
  const results = await searchPeople(query.trim());
  return results
    .filter((p) => p.popularity >= MIN_PERSON_POPULARITY && (p.known_for ?? []).some((k) => k.media_type === "movie"))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 4)
    .map((p) => ({
      slug: tmdbSlug(p.id, p.name),
      name: p.name,
      knownFor: p.known_for_department,
      knownTitles: (p.known_for ?? [])
        .filter((k) => k.media_type === "movie" && k.title)
        .slice(0, 2)
        .map((k) => k.title)
        .join(", "),
    }));
}

/** Matching collections; the ones on the box-set wall come first. */
export async function tmdbSearchBoxSets(query: string): Promise<SearchBoxSet[]> {
  const results = await searchCollections(query.trim());
  const onWall = (c: { id: number }) => BOX_SET_SEEDS.some((s) => s.id === c.id);
  return [...results.filter(onWall), ...results.filter((c) => !onWall(c))]
    .slice(0, 3)
    .map((c) => ({ slug: boxSetSlug(c), name: boxSetName(c) }));
}

/**
 * A random film from the 500 best-rated films that at least 2,000 people have rated (TMDB's own
 * top-rated list lets in obscure films with few votes): a random page, then a film on it.
 */
export async function tmdbRandomFilm(): Promise<FilmCard | undefined> {
  const page = 1 + Math.floor(Math.random() * TOP_RATED_PAGES);
  const films = cards(await list("/discover/movie", { sort_by: "vote_average.desc", "vote_count.gte": 2000, page }));
  return films[Math.floor(Math.random() * films.length)];
}

export async function tmdbSearch(query: string): Promise<SearchItem[]> {
  const results = await searchMovies(query.trim());
  return cards(results).slice(0, 8);
}

/* ---------- people ---------- */

/** Each film once, oldest first, leaving out credits too obscure to have a page worth visiting. */
function filmography(credits: RawCredit[], minVotes: number, role: (c: RawCredit) => string | undefined): CreditCard[] {
  const byFilm = new Map<number, CreditCard>();
  for (const c of credits) {
    if (yearOf(c) === 0 || (c.vote_count ?? 0) < minVotes) continue;
    const existing = byFilm.get(c.id);
    const r = role(c);
    if (existing) {
      if (r && existing.role && !existing.role.includes(r)) existing.role += ` / ${r}`;
      continue;
    }
    byFilm.set(c.id, { ...toCard(c), role: r });
  }
  return [...byFilm.values()].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

const SHELF_ORDER: Record<string, PersonPageData["shelves"][number]["id"][]> = {
  Directing: ["directed", "wrote", "acted"],
  Writing: ["wrote", "directed", "acted"],
};

export async function tmdbPersonPage(id: number): Promise<PersonPageData | undefined> {
  const p = await personOrNull(id);
  if (!p) return undefined;
  const crew = p.movie_credits.crew;
  const shelves = {
    directed: { id: "directed" as const, title: "Directed", films: filmography(crew.filter((c) => c.job === "Director"), 5, () => undefined) },
    wrote: {
      id: "wrote" as const,
      title: "Wrote",
      films: filmography(crew.filter((c) => c.department === "Writing"), 5, (c) => c.job),
    },
    acted: {
      id: "acted" as const,
      title: "Acted in",
      films: filmography(p.movie_credits.cast, 20, (c) => c.character || undefined),
    },
  };
  const order = SHELF_ORDER[p.known_for_department] ?? ["acted", "directed", "wrote"];
  return {
    slug: tmdbSlug(p.id, p.name),
    name: p.name,
    photo: p.profile_path ? `${IMG}/w342${p.profile_path}` : undefined,
    knownFor: p.known_for_department,
    born: p.birthday ?? undefined,
    died: p.deathday ?? undefined,
    birthplace: p.place_of_birth ?? undefined,
    bio: p.biography || undefined,
    shelves: order.map((k) => shelves[k]).filter((s) => s.films.length > 0),
  };
}

/* ---------- aisles and decades ---------- */

const today = () => new Date().toISOString().slice(0, 10);

/** Discover filters for a sort order, optionally inside one decade. */
function discoverParams(sort: AisleSort, decade?: number): Record<string, string | number> {
  const from = decade ? `${decade}-01-01` : undefined;
  const to = decade ? `${decade + 9}-12-31` : undefined;
  const until = to && to < today() ? to : today();
  // older decades have far fewer votes on TMDB, so the bar for "top rated" comes down
  const minVotes = decade && decade < 1960 ? 150 : 600;
  const base = { ...(from && { "primary_release_date.gte": from }), "primary_release_date.lte": until };
  if (sort === "popular") return { ...base, sort_by: "popularity.desc", "vote_count.gte": 50 };
  if (sort === "newest") return { ...base, sort_by: "primary_release_date.desc", "vote_count.gte": 30 };
  return { ...base, sort_by: "vote_average.desc", "vote_count.gte": minVotes };
}

/** Tapes on each aisle page: enough to fill two full shelves. TMDB pages hold 20. */
const TAPES_PER_PAGE = 45;
const TMDB_PAGE_SIZE = 20;
const MAX_AISLE_PAGES = 25;

// These read today's date (for "released by today"), so the whole answer is cached, as with tmdbDailyPicks.
export async function tmdbAislePage(slug: string, sort: AisleSort, decade: number | undefined, page: number): Promise<AislePageData | undefined> {
  "use cache";
  cacheLife("hours");
  const index = GENRE_AISLES.findIndex((g) => g.slug === slug);
  if (index < 0) return undefined;
  const genre = GENRE_AISLES[index];
  const params = { ...discoverParams(sort, decade), with_genres: genre.id };
  // the TMDB pages this aisle page's 45 tapes fall on (two or three of them)
  const start = (page - 1) * TAPES_PER_PAGE;
  const first = Math.floor(start / TMDB_PAGE_SIZE) + 1;
  const last = Math.floor((start + TAPES_PER_PAGE - 1) / TMDB_PAGE_SIZE) + 1;
  const pages = await Promise.all(
    Array.from({ length: last - first + 1 }, (_, i) => listPage("/discover/movie", { ...params, page: first + i })),
  );
  const seen = new Set<number>();
  const skip = start - (first - 1) * TMDB_PAGE_SIZE;
  const movies = pages
    .flatMap((p) => p.results)
    .slice(skip, skip + TAPES_PER_PAGE)
    .filter((m) => !seen.has(m.id) && Boolean(seen.add(m.id)));
  return {
    aisle: { slug: genre.slug, name: genre.name, num: String(index + 1).padStart(2, "0") },
    films: cards(movies),
    page,
    totalPages: Math.min(MAX_AISLE_PAGES, Math.ceil((pages[0].total_pages * TMDB_PAGE_SIZE) / TAPES_PER_PAGE)),
  };
}

/** One shelf per aisle: the aisle's best-rated films. */
export async function tmdbAisleIndex(): Promise<ShelfData[]> {
  "use cache";
  cacheLife("hours");
  return Promise.all(
    GENRE_AISLES.map(async (g, i) => {
      const page = await listPage("/discover/movie", { ...discoverParams("top"), "vote_count.gte": 1500, with_genres: g.id, page: 1 });
      const num = String(i + 1).padStart(2, "0");
      return { slug: g.slug, kicker: `Aisle ${num}`, title: g.name, films: cards(page.results), href: `/aisles/${g.slug}` };
    }),
  );
}

const decadeShelf = async (decade: number, sort: AisleSort, extra: Record<string, string | number> = {}) =>
  cards((await listPage("/discover/movie", { ...discoverParams(sort, decade), ...extra, page: 1 })).results);

export async function tmdbDecadePage(decade: number): Promise<DecadePageData> {
  "use cache";
  cacheLife("hours");
  // the full decade: "the 20s" would mean both the 1920s and the 2020s
  const label = `the ${decade}s`;
  const [best, popular, ...genres] = await Promise.all([
    decadeShelf(decade, "top"),
    decadeShelf(decade, "popular"),
    ...DECADE_GENRES.map((slug) => decadeShelf(decade, "top", { with_genres: genreAisleBySlug(slug)!.id })),
  ]);
  const shelves: ShelfData[] = [
    { slug: "best", kicker: "Best of the decade", title: `The best-loved films of ${label}`, films: best },
    { slug: "popular", kicker: "Most rented", title: `Still popular from ${label}`, films: popular },
    ...DECADE_GENRES.map((slug, i) => {
      const g = genreAisleBySlug(slug)!;
      return { slug, kicker: `Aisle ${String(GENRE_AISLES.indexOf(g) + 1).padStart(2, "0")}`, title: g.name, films: genres[i], href: `/aisles/${slug}?decade=${decade}` };
    }),
  ];
  // a genre that barely existed that decade (animation in the 1930s) doesn't get a near-empty shelf
  return { decade, shelves: shelves.filter((s) => s.films.length >= 6) };
}

/** One shelf per decade: its best-rated films. */
export async function tmdbDecadeIndex(decades: number[]): Promise<ShelfData[]> {
  "use cache";
  cacheLife("hours");
  return Promise.all(
    decades.map(async (decade) => ({
      slug: `${decade}s`,
      kicker: `${decade} – ${decade + 9}`,
      title: `The ${decade}s`,
      films: await decadeShelf(decade, "top"),
      href: `/decades/${decade}s`,
    })),
  );
}

/* ---------- box sets ---------- */

/** "Back to the Future Collection" → "Back to the Future"; "Before... Collection" → "Before". */
const cleanSetName = (name: string) => name.replace(/\s*[-–]?\s*collection$/i, "").replace(/[.…]+$/, "").trim();
const seedName = (id: number) => BOX_SET_SEEDS.find((s) => s.id === id)?.name;
function boxSetName(c: { id: number; name: string }) {
  return seedName(c.id) ?? cleanSetName(c.name);
}
function boxSetSlug(c: { id: number; name: string }) {
  return tmdbSlug(c.id, boxSetName(c));
}

function toBoxSet(c: RawCollection): BoxSetPageData {
  return {
    slug: boxSetSlug(c),
    name: boxSetName(c),
    overview: c.overview,
    poster: c.poster_path ? `${IMG}/w342${c.poster_path}` : undefined,
    // TMDB lists the parts in no fixed order, and includes films that haven't come out yet
    films: cards(c.parts).sort((a, b) => a.year - b.year),
  };
}

export async function tmdbBoxSets(): Promise<BoxSetCard[]> {
  const sets = await Promise.all(BOX_SET_SEEDS.map((s) => collectionOrNull(s.id)));
  return sets
    .filter((c): c is RawCollection => Boolean(c))
    .map(toBoxSet)
    .filter((b) => b.films.length > 1)
    .map((s): BoxSetCard => ({ slug: s.slug, name: s.name, poster: s.poster, films: s.films }));
}

export async function tmdbBoxSetPage(id: number): Promise<BoxSetPageData | undefined> {
  const c = await collectionOrNull(id);
  if (!c) return undefined;
  const set = toBoxSet(c);
  return set.films.length > 0 ? set : undefined;
}

/* ---------- new arrivals ---------- */

export async function tmdbNewArrivals(): Promise<NewArrivalsData> {
  "use cache";
  cacheLife("hours");
  const now = today();
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const [nextWeek, later] = [inDays(7), inDays(14)];
  const [showing, upcoming] = await Promise.all([
    Promise.all([1, 2].map((page) => list("/movie/now_playing", { region: REGION, page }))),
    Promise.all([1, 2].map((page) => list("/movie/upcoming", { region: REGION, page }))),
  ]);
  const seen = new Set<number>();
  const once = (m: RawMovie) => !seen.has(m.id) && Boolean(seen.add(m.id));
  const nowShowing = cards(showing.flat().filter(once).filter((m) => (m.release_date ?? "") <= now));
  const comingSoon: ArrivalCard[] = upcoming
    .flat()
    .filter((m) => (m.release_date ?? "") > now)
    .filter(once)
    .map((m): ArrivalCard => {
      const date = m.release_date!;
      return { ...toCard(m), date, week: date < nextWeek ? "this" : date < later ? "next" : "later" };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return { nowShowing, comingSoon };
}

/* ---------- lookups for the clerk (AI search) ---------- */

/** TMDB's movie genres. They hardly ever change. */
export async function tmdbGenreList(): Promise<{ id: number; name: string }[]> {
  "use cache";
  cacheLife("weeks");
  const res = await tmdb<{ genres: { id: number; name: string }[] }>("/genre/movie/list", { language: "en-US" });
  return res.genres;
}

/**
 * People who might be meant by a name, best known first, with what they're known for so the
 * model can tell namesakes apart. Unlike tmdbSearchPeople this keeps people known for TV too:
 * an actor's films can still be found by their id.
 */
export async function tmdbFindPeople(name: string, limit = 5): Promise<PersonCandidate[]> {
  const results = await searchPeople(name.trim());
  return results
    .filter((p) => p.popularity >= MIN_PERSON_POPULARITY)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      knownFor: p.known_for_department,
      knownTitles: (p.known_for ?? []).flatMap((k) => (k.title ? [k.title] : [])).slice(0, 3),
    }));
}

async function searchKeywords(query: string): Promise<{ id: number; name: string }[]> {
  "use cache";
  cacheLife("days");
  const page = await tmdb<{ results: { id: number; name: string }[] }>("/search/keyword", { query });
  return page.results;
}

/** TMDB keywords matching a term ("heist" → heist, heist movie…). Exact matches first. */
export async function tmdbFindKeywords(term: string, limit = 8): Promise<{ id: number; name: string }[]> {
  const t = term.trim().toLowerCase();
  const results = await searchKeywords(t);
  const exact = results.filter((k) => k.name.toLowerCase() === t);
  return [...exact, ...results.filter((k) => k.name.toLowerCase() !== t)].slice(0, limit);
}

type RawDiscover = { results: RawMovie[]; total_results?: number };

async function discoverPage(params: Record<string, string | number>, page: number): Promise<RawDiscover> {
  "use cache";
  cacheLife("hours");
  return tmdb<RawDiscover>("/discover/movie", { language: "en-US", include_adult: "false", ...params, page });
}

/** A discover search: the first `pages` pages of films (20 each), and how many match in all. */
export async function tmdbDiscover(params: Record<string, string | number>, pages = 2): Promise<{ films: FilmCard[]; total: number }> {
  const first = await discoverPage(params, 1);
  const total = first.total_results ?? first.results.length;
  // only the pages that exist: a search with 25 matches has two pages, not `pages`
  const needed = Math.min(pages, Math.ceil(total / TMDB_PAGE_SIZE)) - 1;
  const more = await Promise.all(Array.from({ length: Math.max(0, needed) }, (_, i) => discoverPage(params, i + 2)));
  const seen = new Set<number>();
  const movies = [first, ...more].flatMap((p) => p.results).filter((m) => !seen.has(m.id) && Boolean(seen.add(m.id)));
  return { films: cards(movies), total };
}
