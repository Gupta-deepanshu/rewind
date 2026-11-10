import type { Filters, Sort } from "./schema";

/**
 * Filters → query parameters for TMDB's /discover/movie.
 * https://developer.themoviedb.org/reference/discover-movie
 *
 * - genres, cast and crew are ANDed ("," in TMDB): "Nolan films with Michael Caine" needs both.
 * - keywords are ORed ("|"): TMDB has near-duplicates ("heist", "heist movie"), and a film
 *   tagged with either should match.
 */

const SORT_BY: Record<Sort, string> = {
  best_rated: "vote_average.desc",
  most_popular: "popularity.desc",
  newest: "primary_release_date.desc",
  oldest: "primary_release_date.asc",
};

/**
 * Below this many votes TMDB's averages are noise (a film with 3 votes of 10 tops "best rated"),
 * so best-rated searches and rating filters get a floor unless the user asked for one.
 */
export const RATED_MIN_VOTES = 200;
export const DEFAULT_MIN_VOTES = 20;

export const DEFAULT_SORT: Sort = "most_popular";

export type DiscoverParams = Record<string, string | number>;

export function toDiscoverParams(f: Filters, today: string): DiscoverParams {
  const sort = f.sort ?? DEFAULT_SORT;
  const p: DiscoverParams = { sort_by: SORT_BY[sort] };

  if (f.genres.length) p.with_genres = f.genres.map((g) => g.id).join(",");
  if (f.keywords.length) p.with_keywords = f.keywords.map((k) => k.id).join("|");
  const cast = f.people.filter((x) => x.role === "cast");
  const crew = f.people.filter((x) => x.role === "crew");
  if (cast.length) p.with_cast = cast.map((x) => x.id).join(",");
  if (crew.length) p.with_crew = crew.map((x) => x.id).join(",");

  if (f.releasedFrom) p["primary_release_date.gte"] = f.releasedFrom;
  // only films that are out: unreleased ones have no ratings and no runtime yet
  p["primary_release_date.lte"] = f.releasedTo && f.releasedTo < today ? f.releasedTo : today;

  if (f.runtimeMin !== undefined) p["with_runtime.gte"] = f.runtimeMin;
  if (f.runtimeMax !== undefined) p["with_runtime.lte"] = f.runtimeMax;
  if (f.minRating !== undefined) p["vote_average.gte"] = f.minRating;
  if (f.language) p.with_original_language = f.language;

  const rated = sort === "best_rated" || f.minRating !== undefined;
  p["vote_count.gte"] = f.minVotes ?? (rated ? RATED_MIN_VOTES : DEFAULT_MIN_VOTES);

  return p;
}
