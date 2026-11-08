/**
 * The store's layout when TMDB is connected: which genres get an aisle, which decades get a
 * shelf, and which box sets stand on the box-set wall. TMDB's genre ids never change, so they
 * live here instead of being fetched.
 */

export type GenreAisle = { id: number; slug: string; name: string };

/** In the order the aisles are numbered. TMDB's "TV Movie" genre has no aisle. */
export const GENRE_AISLES: GenreAisle[] = [
  { id: 18, slug: "drama", name: "Drama" },
  { id: 35, slug: "comedy", name: "Comedy" },
  { id: 53, slug: "thriller", name: "Thriller" },
  { id: 80, slug: "crime", name: "Crime" },
  { id: 9648, slug: "mystery", name: "Mystery" },
  { id: 10749, slug: "romance", name: "Romance" },
  { id: 878, slug: "science-fiction", name: "Science Fiction" },
  { id: 27, slug: "horror", name: "Horror" },
  { id: 16, slug: "animation", name: "Animation" },
  { id: 28, slug: "action", name: "Action" },
  { id: 12, slug: "adventure", name: "Adventure" },
  { id: 14, slug: "fantasy", name: "Fantasy" },
  { id: 10751, slug: "family", name: "Family" },
  { id: 99, slug: "documentary", name: "Documentary" },
  { id: 36, slug: "history", name: "History" },
  { id: 10752, slug: "war", name: "War" },
  { id: 37, slug: "western", name: "Western" },
  { id: 10402, slug: "music", name: "Music" },
];

export const genreAisleById = (id: number) => GENRE_AISLES.find((g) => g.id === id);
export const genreAisleBySlug = (slug: string) => GENRE_AISLES.find((g) => g.slug === slug);

/** Decades with a shelf, oldest first. */
export const DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/** "1980s" ⇄ 1980 */
export const decadeSlug = (decade: number) => `${decade}s`;
export function decadeFromSlug(slug: string): number | undefined {
  const m = /^(\d{4})s$/.exec(slug);
  const decade = m ? Number(m[1]) : NaN;
  return DECADES.includes(decade) ? decade : undefined;
}

/** Genre shelves on each decade page, after the decade's best and most popular. */
export const DECADE_GENRES = ["drama", "comedy", "crime", "science-fiction", "horror", "romance", "animation"];

/**
 * Box sets on the box-set wall: TMDB collection ids (they never change; searching by name finds
 * the wrong set too often). `name` replaces TMDB's name where it reads oddly on a slipcase.
 * The films in each set come from TMDB.
 */
export const BOX_SET_SEEDS: { id: number; name?: string }[] = [
  { id: 230 }, // The Godfather
  { id: 264 }, // Back to the Future
  { id: 123800, name: "The Before Trilogy" },
  { id: 131, name: "Three Colours" },
  { id: 158391, name: "The Apu Trilogy" },
  { id: 8091 }, // Alien
  { id: 119 }, // The Lord of the Rings
  { id: 10194 }, // Toy Story
  { id: 8945 }, // Mad Max
  { id: 84 }, // Indiana Jones
  { id: 263 }, // The Dark Knight
  { id: 58588 }, // Infernal Affairs
];
