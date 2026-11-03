export type CastMember = { name: string; character: string; /** full image URL */ photo?: string };
export type CrewMember = { job: string; name: string };

/** Everything the film page shows beyond the basics. */
export type FilmDetails = {
  originalTitle?: string;
  originalTitleLatin?: string;
  runtime: number;
  genres: string[];
  language: string;
  colour?: "Colour" | "B&W";
  synopsis: string;
  /** Big line at the top of the back of the box. */
  tagline: string;
  /** Paragraph on the back of the box. */
  backCopy: string;
  /** Why the staff picked it (only for staff picks). */
  staffNote?: string;
  writers: string[];
  studio: string;
  cast: CastMember[];
  crew: CrewMember[];
  /** Average rating out of 10, and how many votes it is based on. */
  rating?: number;
  voteCount?: number;
  trailerUrl?: string;
  /** Full image URLs of film stills. */
  stills?: string[];
};

export type Film = {
  slug: string;
  title: string;
  year: number;
  directorName?: string;
  details?: FilmDetails;
};

/** The small, serialisable shape used by shelves and client components. */
export type FilmCard = {
  slug: string;
  title: string;
  year: number;
  directorName?: string;
};

export type PickCard = FilmCard & {
  originalTitle?: string;
  runtime: number;
  genres: string[];
  synopsis: string;
  staffNote: string;
  starring: string[];
};

export type AisleShelfData = {
  slug: string;
  num: string;
  name: string;
  jp: string;
  films: FilmCard[];
};

export type DirectorShelfData = {
  slug: string;
  name: string;
  nativeName?: string;
  active: [number, number];
  films: FilmCard[];
};

export type FilmPageData = {
  film: Film;
  aisle?: { slug: string; num: string; name: string };
  more?: { kicker: string; title: string; films: FilmCard[] };
};

export type SearchItem = FilmCard;
