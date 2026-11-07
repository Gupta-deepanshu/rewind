import { cacheLife } from "next/cache";
import { tmdbSlug } from "../slug";
import type {
  AisleShelfData,
  CastMember,
  CrewMember,
  DirectorShelfData,
  Film,
  FilmCard,
  FilmPageData,
  PickCard,
  SearchItem,
} from "../types";

/**
 * The live source: The Movie Database (TMDB).
 * Every request is cached with `use cache`, so each page only calls TMDB when its cache expires.
 *
 * api.tmdb.org is TMDB's alternative host. It is used by default because api.themoviedb.org
 * is blocked by some internet providers. Override it with TMDB_API_BASE.
 */
const BASE = process.env.TMDB_API_BASE ?? "https://api.tmdb.org/3";
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

type RawPage = { results: RawMovie[] };

type RawDetails = RawMovie & {
  original_title: string;
  original_language: string;
  overview: string;
  tagline: string;
  runtime: number | null;
  genres: { name: string }[];
  vote_average: number;
  vote_count: number;
  production_companies: { name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string }[];
  credits: {
    cast: { name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string; department: string }[];
  };
  videos: { results: { key: string; site: string; type: string; official: boolean }[] };
  images: { backdrops: { file_path: string }[] };
  recommendations: RawPage;
};

type RawPerson = {
  id: number;
  name: string;
  movie_credits: { crew: (RawMovie & { job: string })[] };
};

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

async function person(id: number): Promise<RawPerson> {
  "use cache";
  cacheLife("days");
  return tmdb<RawPerson>(`/person/${id}`, { language: "en-US", append_to_response: "movie_credits" });
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
    poster: posterUrl(m),
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
  const p = await person(personId);
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
    { slug: "new-arrivals", num: "01", name: "New Arrivals", jp: "新作", films: now },
    { slug: "drama", num: "02", name: "Drama", jp: "ドラマ", films: drama },
    { slug: "thriller-mystery", num: "03", name: "Thriller & Mystery", jp: "スリラー", films: thriller },
  ];
}

export async function tmdbDirectors(seeds: { name: string; nativeName?: string }[]): Promise<DirectorShelfData[]> {
  const shelves = await Promise.all(
    seeds.map(async (seed): Promise<DirectorShelfData | undefined> => {
      const id = await findDirectorId(seed.name);
      if (!id) return undefined;
      const { name, films } = await directed(id);
      if (films.length === 0) return undefined;
      return {
        slug: tmdbSlug(id, name),
        name,
        nativeName: seed.nativeName,
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

export async function tmdbSearch(query: string): Promise<SearchItem[]> {
  const results = await searchMovies(query.trim());
  return cards(results).slice(0, 8);
}
