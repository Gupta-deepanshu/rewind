export type CastMember = {
  name: string;
  character: string;
  /** full image URL */
  photo?: string;
  /** Link to their person page, when we have one. */
  slug?: string;
};
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
  /** The (first) director's person page. */
  directorSlug?: string;
  /** Full URL of the film's poster, when there is one. */
  poster?: string;
  /** The box set (TMDB collection) the film belongs to. */
  boxSet?: { slug: string; name: string };
  /** Genres that have an aisle page, for linking the film's genre tags. */
  aisles?: { slug: string; name: string }[];
  details?: FilmDetails;
};

/** The small, serialisable shape used by shelves and client components. */
export type FilmCard = {
  slug: string;
  title: string;
  year: number;
  directorName?: string;
  poster?: string;
};

export type PickCard = FilmCard & {
  originalTitle?: string;
  runtime: number;
  genres: string[];
  synopsis: string;
  /** The quote on the note card: the film's tagline (TMDB) or a staff note (example data). Can be empty. */
  note: string;
  /** The small line under the note: why this film is on today's shelf. */
  reason: string;
  starring: string[];
};

export type AisleShelfData = {
  slug: string;
  num: string;
  name: string;
  films: FilmCard[];
  /** The page with the whole aisle. */
  href?: string;
};

export type DirectorShelfData = {
  slug: string;
  name: string;
  active: [number, number];
  films: FilmCard[];
};

export type FilmPageData = {
  film: Film;
  aisle?: { slug: string; num: string; name: string };
  more?: { kicker: string; title: string; films: FilmCard[] };
};

export type SearchItem = FilmCard;

/** A person in search results: what they're known for, and a couple of their films. */
export type SearchPerson = { slug: string; name: string; knownFor?: string; knownTitles?: string };

export type SearchBoxSet = { slug: string; name: string };

export type SearchResults = { films: SearchItem[]; people: SearchPerson[]; boxSets: SearchBoxSet[] };

/* ---------- people ---------- */

/** A film in someone's filmography, with what they did on it. */
export type CreditCard = FilmCard & { role?: string };

export type PersonPageData = {
  slug: string;
  name: string;
  photo?: string;
  /** "Directing", "Acting", "Writing"… */
  knownFor?: string;
  born?: string;
  died?: string;
  birthplace?: string;
  bio?: string;
  /** Each kind of credit is one shelf, oldest first. Empty shelves are left out. */
  shelves: { id: "directed" | "acted" | "wrote"; title: string; films: CreditCard[] }[];
};

/* ---------- browsing ---------- */

/** One genre aisle in the store. */
export type AisleSign = { slug: string; num: string; name: string };

export type AisleSort = "top" | "popular" | "newest";

export type AislePageData = {
  aisle: AisleSign;
  films: FilmCard[];
  page: number;
  totalPages: number;
};

/** A labelled shelf of tapes, used on the decade and index pages. */
export type ShelfData = { slug: string; kicker: string; title: string; films: FilmCard[]; href?: string };

export type DecadePageData = { decade: number; shelves: ShelfData[] };

export type BoxSetCard = { slug: string; name: string; poster?: string; films: FilmCard[] };

export type BoxSetPageData = BoxSetCard & { overview: string };

/**
 * A film that hasn't opened yet: the date it opens (YYYY-MM-DD), and whether that is in the next
 * 7 days, the 7 after, or later.
 */
export type ArrivalCard = FilmCard & { date: string; week: "this" | "next" | "later" };

export type NewArrivalsData = { nowShowing: FilmCard[]; comingSoon: ArrivalCard[] };
