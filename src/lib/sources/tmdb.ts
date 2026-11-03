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

  const res = await fetch(url, { headers });
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
};

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

async function movie(id: number): Promise<RawDetails> {
  const m = await movieOrNull(id);
  if (!m) throw new Error(`TMDB has no film ${id}`);
  return m;
}

async function findMovieId(title: string, year: number): Promise<number | undefined> {
  "use cache";
  cacheLife("weeks");
  const page = await tmdb<RawPage>("/search/movie", { query: title, year, include_adult: "false" });
  return page.results[0]?.id;
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

export async function tmdbStaffPicks(seeds: { title: string; year: number; staffNote: string }[]): Promise<PickCard[]> {
  const picks = await Promise.all(
    seeds.map(async (seed): Promise<PickCard | undefined> => {
      const id = await findMovieId(seed.title, seed.year);
      if (!id) return undefined;
      const film = toFilm(await movie(id), seed.staffNote);
      const d = film.details!;
      return {
        slug: film.slug,
        title: film.title,
        year: film.year,
        directorName: film.directorName,
        originalTitle: d.originalTitle,
        runtime: d.runtime,
        genres: d.genres,
        synopsis: d.synopsis,
        staffNote: seed.staffNote,
        starring: d.cast.slice(0, 2).map((c) => c.name),
      };
    }),
  );
  return picks.filter((p): p is PickCard => Boolean(p));
}

export async function tmdbAisles(): Promise<AisleShelfData[]> {
  const topRated = { sort_by: "vote_average.desc", "vote_count.gte": 2500 };
  const [now, drama, thriller] = await Promise.all([
    list("/movie/now_playing", { page: 1 }),
    list("/discover/movie", { ...topRated, with_genres: "18" }),
    list("/discover/movie", { ...topRated, with_genres: "53|9648" }),
  ]);
  return [
    { slug: "new-arrivals", num: "01", name: "New Arrivals", jp: "新作", films: cards(now) },
    { slug: "drama", num: "02", name: "Drama", jp: "ドラマ", films: cards(drama) },
    { slug: "thriller-mystery", num: "03", name: "Thriller & Mystery", jp: "スリラー", films: cards(thriller) },
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
