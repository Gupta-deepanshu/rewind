/**
 * The TMDB source against a fake TMDB: `fetch` is replaced by a router that answers by path, so
 * these tests check how TMDB's answers are turned into pages without calling TMDB.
 * @jest-environment node
 */
import {
  tmdbAislePage,
  tmdbBoxSetPage,
  tmdbDecadePage,
  tmdbDiscover,
  tmdbFilmPage,
  tmdbFindKeywords,
  tmdbFindPeople,
  tmdbGenreList,
  tmdbNewArrivals,
  tmdbPersonPage,
  tmdbRandomFilm,
  tmdbSearchBoxSets,
  tmdbSearchPeople,
} from "./tmdb";

jest.mock("next/cache", () => ({ cacheLife: jest.fn() }));

type Route = (params: URLSearchParams) => unknown;
let routes: Record<string, Route> = {};
let calls: URL[] = [];

/** Answer requests by path; a path with no route answers 404 like TMDB does. */
function serve(r: Record<string, Route>) {
  routes = r;
}

beforeEach(() => {
  process.env.TMDB_READ_ACCESS_TOKEN = "test-token";
  routes = {};
  calls = [];
  global.fetch = jest.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const path = url.pathname.replace(/^\/3/, "");
    const route = routes[path];
    if (!route) return new Response(JSON.stringify({ status_message: "not found" }), { status: 404 });
    return new Response(JSON.stringify(route(url.searchParams)), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  delete process.env.TMDB_READ_ACCESS_TOKEN;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const movie = (id: number, title: string, date: string, votes = 1000) => ({
  id,
  title,
  release_date: date,
  vote_count: votes,
  poster_path: `/poster-${id}.jpg`,
});

/** A discover/list page of `count` films whose ids are page * 100 + index. */
const listPage = (page: number, count = 20, totalPages = 500) => ({
  results: Array.from({ length: count }, (_, i) => movie(page * 100 + i, `Film ${page * 100 + i}`, "2000-01-01")),
  total_pages: totalPages,
});

describe("tmdbPersonPage", () => {
  const kurosawa = {
    id: 5026,
    name: "Akira Kurosawa",
    biography: "A Japanese filmmaker.",
    birthday: "1910-03-23",
    deathday: "1998-09-06",
    place_of_birth: "Tokyo, Japan",
    profile_path: "/kurosawa.jpg",
    known_for_department: "Directing",
    movie_credits: {
      cast: [{ ...movie(1, "A Cameo", "1980-01-01", 5), character: "Himself" }],
      crew: [
        { ...movie(10, "Seven Samurai", "1954-04-26", 3000), job: "Director", department: "Directing" },
        { ...movie(10, "Seven Samurai", "1954-04-26", 3000), job: "Screenplay", department: "Writing" },
        { ...movie(10, "Seven Samurai", "1954-04-26", 3000), job: "Editor", department: "Editing" },
        { ...movie(11, "Rashomon", "1950-08-25", 2000), job: "Director", department: "Directing" },
        { ...movie(11, "Rashomon", "1950-08-25", 2000), job: "Director", department: "Directing" },
        { ...movie(12, "A Lost Short", "1940-01-01", 2), job: "Director", department: "Directing" },
        { ...movie(13, "Not Out Yet", "", 100), job: "Director", department: "Directing" },
        { ...movie(14, "Ran", "1985-06-01", 1500), job: "Writer", department: "Writing" },
        { ...movie(14, "Ran", "1985-06-01", 1500), job: "Screenplay", department: "Writing" },
      ],
    },
  };

  it("maps the person's facts", async () => {
    serve({ "/person/5026": () => kurosawa });
    const p = await tmdbPersonPage(5026);
    expect(p).toMatchObject({
      slug: "5026-akira-kurosawa",
      name: "Akira Kurosawa",
      photo: "https://image.tmdb.org/t/p/w342/kurosawa.jpg",
      knownFor: "Directing",
      born: "1910-03-23",
      died: "1998-09-06",
      birthplace: "Tokyo, Japan",
      bio: "A Japanese filmmaker.",
    });
  });

  it("puts each film on a shelf once, oldest first, leaving out obscure and undated credits", async () => {
    serve({ "/person/5026": () => kurosawa });
    const p = await tmdbPersonPage(5026);
    const directed = p!.shelves.find((s) => s.id === "directed")!;
    expect(directed.films.map((f) => f.title)).toEqual(["Rashomon", "Seven Samurai"]);
  });

  it("joins two jobs on the same film into one role", async () => {
    serve({ "/person/5026": () => kurosawa });
    const wrote = (await tmdbPersonPage(5026))!.shelves.find((s) => s.id === "wrote")!;
    expect(wrote.films.map((f) => [f.title, f.role])).toEqual([
      ["Seven Samurai", "Screenplay"],
      ["Ran", "Writer / Screenplay"],
    ]);
  });

  it("orders shelves by what they're known for and drops empty ones", async () => {
    serve({ "/person/5026": () => kurosawa });
    // the one acting credit has too few votes, so there's no acting shelf
    expect((await tmdbPersonPage(5026))!.shelves.map((s) => s.id)).toEqual(["directed", "wrote"]);

    serve({
      "/person/5026": () => ({
        ...kurosawa,
        known_for_department: "Acting",
        movie_credits: { ...kurosawa.movie_credits, cast: [{ ...movie(1, "A Role", "1980-01-01", 500), character: "Lead" }] },
      }),
    });
    expect((await tmdbPersonPage(5026))!.shelves.map((s) => s.id)).toEqual(["acted", "directed", "wrote"]);
  });

  it("is undefined for someone TMDB doesn't know", async () => {
    serve({});
    await expect(tmdbPersonPage(999)).resolves.toBeUndefined();
  });
});

describe("tmdbAislePage", () => {
  beforeEach(() => serve({ "/discover/movie": (q) => listPage(Number(q.get("page"))) }));

  const pagesAsked = () => calls.map((u) => Number(u.searchParams.get("page"))).sort((a, b) => a - b);

  it("fills page 1 with the first 45 tapes (TMDB pages 1–3)", async () => {
    const page = await tmdbAislePage("drama", "top", undefined, 1);
    expect(pagesAsked()).toEqual([1, 2, 3]);
    expect(page!.films).toHaveLength(45);
    expect(page!.films[0].slug).toBe("100-film-100");
    expect(page!.films[44].slug).toBe("304-film-304");
  });

  it("carries on where page 1 stopped (tapes 46–90, TMDB pages 3–5)", async () => {
    const page = await tmdbAislePage("drama", "top", undefined, 2);
    expect(pagesAsked()).toEqual([3, 4, 5]);
    expect(page!.films[0].slug).toBe("305-film-305");
    expect(page!.films[44].slug).toBe("509-film-509");
  });

  it("asks TMDB for the aisle's genre, sorted and filtered as chosen", async () => {
    await tmdbAislePage("science-fiction", "newest", 1980, 1);
    const q = calls[0].searchParams;
    expect(q.get("with_genres")).toBe("878");
    expect(q.get("sort_by")).toBe("primary_release_date.desc");
    expect(q.get("primary_release_date.gte")).toBe("1980-01-01");
    expect(q.get("primary_release_date.lte")).toBe("1989-12-31");
  });

  it("lowers the vote bar for top-rated films from older decades", async () => {
    await tmdbAislePage("drama", "top", 1930, 1);
    expect(calls[0].searchParams.get("vote_count.gte")).toBe("150");
    calls = [];
    await tmdbAislePage("drama", "top", 1990, 1);
    expect(calls[0].searchParams.get("vote_count.gte")).toBe("600");
  });

  it("numbers the aisle and counts its pages (at most 25)", async () => {
    const page = await tmdbAislePage("comedy", "top", undefined, 1);
    expect(page!.aisle).toEqual({ slug: "comedy", num: "02", name: "Comedy" });
    expect(page!.totalPages).toBe(25);

    serve({ "/discover/movie": (q) => listPage(Number(q.get("page")), 20, 3) });
    expect((await tmdbAislePage("comedy", "top", undefined, 1))!.totalPages).toBe(2); // 60 films → 2 pages of 45
  });

  it("has no page for a genre without an aisle, and doesn't ask TMDB", async () => {
    expect(await tmdbAislePage("tv-movie", "top", undefined, 1)).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe("tmdbDecadePage", () => {
  it("names the decade in full and drops genre shelves with fewer than 6 films", async () => {
    serve({
      // animation (16) barely existed in the 1930s: only 3 films
      "/discover/movie": (q) => listPage(1, q.get("with_genres") === "16" ? 3 : 10),
    });
    const page = await tmdbDecadePage(1930);
    expect(page.shelves[0].title).toBe("The best-loved films of the 1930s");
    expect(page.shelves.map((s) => s.slug)).not.toContain("animation");
    expect(page.shelves.map((s) => s.slug)).toContain("drama");
    expect(page.shelves.find((s) => s.slug === "drama")!.href).toBe("/aisles/drama?decade=1930");
  });
});

describe("tmdbSearchPeople", () => {
  it("keeps well-known film people, most popular first", async () => {
    serve({
      "/search/person": () => ({
        results: [
          { id: 1, name: "Nolan North", known_for_department: "Acting", popularity: 1.99, known_for: [{ title: "Uncharted", media_type: "movie" }] },
          {
            id: 2,
            name: "Christopher Nolan",
            known_for_department: "Directing",
            popularity: 8.6,
            known_for: [
              { title: "Interstellar", media_type: "movie" },
              { title: "Inception", media_type: "movie" },
              { title: "Tenet", media_type: "movie" },
            ],
          },
          { id: 3, name: "An Obscure Nolan", known_for_department: "Acting", popularity: 0.1, known_for: [{ title: "X", media_type: "movie" }] },
          { id: 4, name: "A TV Nolan", known_for_department: "Acting", popularity: 5, known_for: [{ name: "A Show", media_type: "tv" }] },
        ],
      }),
    });
    const people = await tmdbSearchPeople("nolan");
    expect(people.map((p) => p.name)).toEqual(["Christopher Nolan", "Nolan North"]);
    expect(people[0]).toEqual({
      slug: "2-christopher-nolan",
      name: "Christopher Nolan",
      knownFor: "Directing",
      knownTitles: "Interstellar, Inception",
    });
  });
});

describe("box sets", () => {
  it("search puts sets on the box-set wall first, with their wall names", async () => {
    serve({
      "/search/collection": () => ({
        results: [
          { id: 900, name: "Some Other Collection" },
          { id: 123800, name: "Before... Collection" },
          { id: 901, name: "Another Collection" },
          { id: 902, name: "A Fourth Collection" },
        ],
      }),
    });
    expect(await tmdbSearchBoxSets("before")).toEqual([
      { slug: "123800-the-before-trilogy", name: "The Before Trilogy" },
      { slug: "900-some-other", name: "Some Other" },
      { slug: "901-another", name: "Another" },
    ]);
  });

  it("a set's page lists its released films in order", async () => {
    serve({
      "/collection/264": () => ({
        id: 264,
        name: "Back to the Future Collection",
        overview: "Doc and Marty.",
        poster_path: "/bttf.jpg",
        parts: [
          movie(2, "Back to the Future Part II", "1989-11-22"),
          movie(4, "Back to the Future Part IV", ""),
          movie(1, "Back to the Future", "1985-07-03"),
          movie(3, "Back to the Future Part III", "1990-05-25"),
        ],
      }),
    });
    const set = await tmdbBoxSetPage(264);
    expect(set!.name).toBe("Back to the Future");
    expect(set!.slug).toBe("264-back-to-the-future");
    expect(set!.films.map((f) => f.year)).toEqual([1985, 1989, 1990]);
    expect(set!.poster).toBe("https://image.tmdb.org/t/p/w342/bttf.jpg");
  });

  it("a set TMDB doesn't know has no page", async () => {
    serve({});
    await expect(tmdbBoxSetPage(1)).resolves.toBeUndefined();
  });
});

describe("tmdbNewArrivals", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-11-12T10:00:00Z"), doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    serve({
      "/movie/now_playing": (q) => ({
        results:
          q.get("page") === "1"
            ? [movie(1, "In Cinemas", "2026-10-30"), movie(2, "Opens Tomorrow", "2026-11-13")]
            : [movie(1, "In Cinemas", "2026-10-30")],
      }),
      "/movie/upcoming": (q) => ({
        results:
          q.get("page") === "1"
            ? [movie(10, "Already Out", "2026-11-10"), movie(11, "Next Week", "2026-11-19"), movie(12, "This Week", "2026-11-13")]
            : [movie(13, "Later On", "2026-12-30"), movie(11, "Next Week", "2026-11-19"), movie(14, "End Of Next Week", "2026-11-25")],
      }),
    });
  });

  it("shows what's out now, once each", async () => {
    const { nowShowing } = await tmdbNewArrivals();
    expect(nowShowing.map((f) => f.title)).toEqual(["In Cinemas"]);
  });

  it("lists what's coming by date, grouped into this week, next week and later", async () => {
    const { comingSoon } = await tmdbNewArrivals();
    expect(comingSoon.map((f) => [f.title, f.week])).toEqual([
      ["This Week", "this"],
      ["Next Week", "next"], // exactly 7 days away
      ["End Of Next Week", "next"],
      ["Later On", "later"],
    ]);
  });

  it("follows the US cinema listings unless TMDB_REGION says otherwise", async () => {
    await tmdbNewArrivals();
    expect(calls.every((u) => u.searchParams.get("region") === "US")).toBe(true);
  });
});

describe("tmdbFilmPage", () => {
  it("links the film to its director, cast, box set and aisles", async () => {
    serve({
      "/movie/105": () => ({
        ...movie(105, "Back to the Future", "1985-07-03"),
        original_title: "Back to the Future",
        original_language: "en",
        overview: "Marty goes back. He meets his parents.",
        tagline: "He's the only kid ever to get into trouble before he was born.",
        runtime: 116,
        genres: [
          { id: 878, name: "Science Fiction" },
          { id: 10770, name: "TV Movie" },
        ],
        belongs_to_collection: { id: 264, name: "Back to the Future Collection" },
        vote_average: 8.3,
        vote_count: 20000,
        production_companies: [{ name: "Amblin" }],
        spoken_languages: [{ iso_639_1: "en", english_name: "English" }],
        credits: {
          cast: [{ id: 521, name: "Michael J. Fox", character: "Marty McFly", profile_path: null }],
          crew: [{ id: 24, name: "Robert Zemeckis", job: "Director", department: "Directing" }],
        },
        videos: { results: [] },
        images: { backdrops: [] },
        recommendations: { results: [] },
      }),
      "/person/24": () => ({
        id: 24,
        name: "Robert Zemeckis",
        movie_credits: { cast: [], crew: [{ ...movie(105, "Back to the Future", "1985-07-03"), job: "Director" }] },
      }),
    });
    const { film } = (await tmdbFilmPage(105))!;
    expect(film.directorSlug).toBe("24-robert-zemeckis");
    expect(film.details!.cast[0].slug).toBe("521-michael-j-fox");
    expect(film.boxSet).toEqual({ slug: "264-back-to-the-future", name: "Back to the Future" });
    // TV Movie has no aisle, so only Science Fiction links anywhere
    expect(film.aisles).toEqual([{ slug: "science-fiction", name: "Science Fiction" }]);
  });
});

describe("tmdbRandomFilm", () => {
  it("picks from well-rated films that plenty of people have rated", async () => {
    serve({ "/discover/movie": (q) => listPage(Number(q.get("page"))) });
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const film = await tmdbRandomFilm();
    const q = calls[0].searchParams;
    expect(q.get("sort_by")).toBe("vote_average.desc");
    expect(q.get("vote_count.gte")).toBe("2000");
    expect(q.get("page")).toBe("13"); // 1 + floor(0.5 * 25)
    expect(film?.slug).toBe("1310-film-1310"); // the middle film of that page
  });
});

/* ---------- lookups for the clerk (AI search) ---------- */

describe("tmdbGenreList", () => {
  it("returns TMDB's genres", async () => {
    serve({ "/genre/movie/list": () => ({ genres: [{ id: 80, name: "Crime" }] }) });
    expect(await tmdbGenreList()).toEqual([{ id: 80, name: "Crime" }]);
  });
});

describe("tmdbFindPeople", () => {
  it("returns ids with what each person is known for, best known first, without namesakes", async () => {
    serve({
      "/search/person": () => ({
        results: [
          { id: 1, name: "Michael Caine", known_for_department: "Acting", popularity: 0.1, known_for: [] }, // a namesake
          { id: 3895, name: "Michael Caine", known_for_department: "Acting", popularity: 9, known_for: [{ title: "The Prestige", media_type: "movie" }, { name: "A TV show", media_type: "tv" }] },
          { id: 2, name: "Michael Caine Jr", known_for_department: "Acting", popularity: 1, known_for: [] },
        ],
      }),
    });
    expect(await tmdbFindPeople(" Michael Caine ")).toEqual([
      { id: 3895, name: "Michael Caine", knownFor: "Acting", knownTitles: ["The Prestige"] },
      { id: 2, name: "Michael Caine Jr", knownFor: "Acting", knownTitles: [] },
    ]);
    expect(calls[0].searchParams.get("query")).toBe("Michael Caine");
  });
});

describe("tmdbFindKeywords", () => {
  it("puts the exact match first and caps the list", async () => {
    serve({
      "/search/keyword": () => ({
        results: [{ id: 207268, name: "heist movie" }, { id: 10051, name: "Heist" }, ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `heist ${i}` }))],
      }),
    });
    const found = await tmdbFindKeywords("heist");
    expect(found.slice(0, 2)).toEqual([{ id: 10051, name: "Heist" }, { id: 207268, name: "heist movie" }]);
    expect(found).toHaveLength(8);
  });
});

describe("tmdbDiscover", () => {
  it("passes the filters through and reads two pages when there are more", async () => {
    serve({ "/discover/movie": (q) => ({ ...listPage(Number(q.get("page"))), total_results: 300 }) });
    const { films, total } = await tmdbDiscover({ with_genres: "80", "vote_count.gte": 200 });
    expect(total).toBe(300);
    expect(films).toHaveLength(40);
    expect(calls.map((c) => c.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(calls[0].searchParams.get("with_genres")).toBe("80");
    expect(calls[0].searchParams.get("include_adult")).toBe("false");
  });

  it("stops at one page when that is all there is, and reports zero results", async () => {
    serve({ "/discover/movie": () => ({ results: [movie(1, "Only One", "1995-01-01")], total_results: 1 }) });
    expect((await tmdbDiscover({})).films).toHaveLength(1);
    expect(calls).toHaveLength(1);

    serve({ "/discover/movie": () => ({ results: [], total_results: 0 }) });
    expect(await tmdbDiscover({})).toEqual({ films: [], total: 0 });
  });
});
