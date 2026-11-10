/**
 * The catalog with no TMDB key (jest.env.js clears it): every page is served from the example data.
 * @jest-environment node
 */
import {
  askTheClerk,
  dataSource,
  getAisleIndex,
  getAislePage,
  getAisleSigns,
  getBoxSetPage,
  getBoxSets,
  getDecadeIndex,
  getDecadePage,
  getFilmPage,
  getNewArrivals,
  getPersonPage,
  getPrebuiltPeople,
  getRandomFilm,
  searchAll,
  shelvesOf,
} from "./catalog";
import type { FilmCard } from "./types";
import { spineLook } from "./vhs";

// The same room the catalog gives a shelf: 23 standard 5em cases with their 0.6em gaps.
const ROOM = 23 * (5 + 0.6);
const widthOf = (row: FilmCard[]) => row.reduce((w, f) => w + spineLook(f.title, f.year).width + 0.6, 0);
const film = (n: number, title = `Film number ${n}`): FilmCard => ({ slug: `f-${n}`, title, year: 1990 + (n % 30) });

it("uses the example data without a TMDB key", () => {
  expect(dataSource()).toBe("example");
});

describe("shelvesOf", () => {
  it("keeps every film, in order", () => {
    const films = Array.from({ length: 60 }, (_, i) => film(i));
    expect(shelvesOf(films).flat()).toEqual(films);
  });

  it("fills each shelf without going past its edge (except the last, see below)", () => {
    const rows = shelvesOf(Array.from({ length: 60 }, (_, i) => film(i)));
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows.slice(0, -1)) expect(widthOf(row)).toBeLessThanOrEqual(ROOM);
  });

  it("puts a short leftover on the shelf above instead of a nearly empty last shelf", () => {
    // find how many films fill exactly one shelf, then add two more
    const one = shelvesOf(Array.from({ length: 40 }, (_, i) => film(i)))[0].length;
    const rows = shelvesOf(Array.from({ length: one + 2 }, (_, i) => film(i)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(one + 2);
  });

  it("starts a new shelf for a leftover of four or more", () => {
    const one = shelvesOf(Array.from({ length: 40 }, (_, i) => film(i)))[0].length;
    expect(shelvesOf(Array.from({ length: one + 4 }, (_, i) => film(i)))).toHaveLength(2);
  });

  it("returns no shelves for no films", () => {
    expect(shelvesOf([])).toEqual([]);
  });
});

describe("aisles", () => {
  it("lists the example store's aisles, without New Arrivals (it has its own page)", () => {
    const signs = getAisleSigns();
    expect(signs.map((s) => s.slug)).toEqual(["drama", "thriller-mystery"]);
  });

  it("gives each aisle on the index a shelf and a link", async () => {
    const shelves = await getAisleIndex();
    expect(shelves.map((s) => s.href)).toEqual(["/aisles/drama", "/aisles/thriller-mystery"]);
    for (const s of shelves) expect(s.films.length).toBeGreaterThan(0);
  });

  it("serves a whole aisle on one page", async () => {
    const page = await getAislePage("drama", {});
    expect(page?.aisle).toEqual({ slug: "drama", num: "02", name: "Drama" });
    expect(page?.page).toBe(1);
    expect(page?.totalPages).toBe(1);
    expect(page?.films.length).toBeGreaterThan(5);
  });

  it("sorts newest first", async () => {
    const page = await getAislePage("drama", { sort: "newest" });
    const years = page!.films.map((f) => f.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("filters to a decade", async () => {
    const page = await getAislePage("drama", { decade: 1950 });
    expect(page!.films.length).toBeGreaterThan(0);
    for (const f of page!.films) {
      expect(f.year).toBeGreaterThanOrEqual(1950);
      expect(f.year).toBeLessThan(1960);
    }
  });

  it("has no page for an unknown aisle", async () => {
    expect(await getAislePage("nope", {})).toBeUndefined();
  });
});

describe("people", () => {
  it("serves a director's page from the example data", async () => {
    const person = await getPersonPage("akira-kurosawa");
    expect(person?.name).toBe("Akira Kurosawa");
    expect(person?.knownFor).toBe("Directing");
    expect(person?.shelves).toHaveLength(1);
    expect(person?.shelves[0].id).toBe("directed");
    expect(person?.shelves[0].films.map((f) => f.title)).toContain("Seven Samurai");
  });

  it("has no page for someone unknown", async () => {
    expect(await getPersonPage("nobody-at-all")).toBeUndefined();
    expect(await getPersonPage("999-nobody")).toBeUndefined();
  });

  it("prebuilds every example director's page", async () => {
    expect(await getPrebuiltPeople()).toContain("alfred-hitchcock");
  });

  it("links a film page's director to their person page", async () => {
    const page = await getFilmPage("seven-samurai");
    expect(page?.film.directorSlug).toBe("akira-kurosawa");
  });
});

describe("decades", () => {
  it("shelves every example film from a decade, oldest first", async () => {
    const { decade, shelves } = await getDecadePage(1950);
    expect(decade).toBe(1950);
    expect(shelves).toHaveLength(1);
    const years = shelves[0].films.map((f) => f.year);
    expect(years.every((y) => y >= 1950 && y < 1960)).toBe(true);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("leaves decades with nothing on the shelf off the index", async () => {
    const index = await getDecadeIndex();
    expect(index.length).toBeGreaterThan(0);
    for (const s of index) expect(s.films.length).toBeGreaterThan(0);
    expect(index.find((s) => s.slug === "1950s")?.href).toBe("/decades/1950s");
  });

  it("names the decade in full, so the 1920s and 2020s can't be confused", async () => {
    const [twenties, twentyTwenties] = await Promise.all([getDecadePage(1920), getDecadePage(2020)]);
    expect(twenties.shelves[0].title).toBe("Everything from the 1920s");
    expect(twentyTwenties.shelves[0].title).toBe("Everything from the 2020s");
  });
});

describe("box sets", () => {
  it("are empty without TMDB (the example data has none)", async () => {
    expect(await getBoxSets()).toEqual([]);
    expect(await getBoxSetPage("230-the-godfather")).toBeUndefined();
  });
});

describe("new arrivals", () => {
  it("shows the example New Arrivals aisle as now showing, with nothing coming soon", async () => {
    const { nowShowing, comingSoon } = await getNewArrivals();
    expect(nowShowing.length).toBeGreaterThan(0);
    expect(comingSoon).toEqual([]);
  });
});

describe("search", () => {
  it("finds films and directors, and no box sets", async () => {
    const { films, people, boxSets } = await searchAll("kuro");
    expect(people.map((p) => p.name)).toEqual(["Akira Kurosawa"]);
    expect(people[0].slug).toBe("akira-kurosawa");
    expect(people[0].knownTitles).toBeTruthy();
    expect(films.every((f) => f.directorName === "Akira Kurosawa" || /kuro/i.test(f.title))).toBe(true);
    expect(boxSets).toEqual([]);
  });

  it("ignores accents and case", async () => {
    const { people } = await searchAll("OZU");
    expect(people.map((p) => p.name)).toEqual(["Yasujirō Ozu"]);
  });
});

describe("surprise me", () => {
  it("picks a film that has a page", async () => {
    const pick = await getRandomFilm();
    expect(await getFilmPage(pick.slug)).toBeDefined();
  });
});

describe("askTheClerk", () => {
  it("without keys, searches the example shelf by title and never calls a model", async () => {
    const answer = await askTheClerk("samurai", undefined, "1.2.3.4");
    expect(answer.mode).toBe("keyword");
    expect(answer.notice).toMatch(/isn't connected/);
    expect(answer.films.map((f) => f.title)).toContain("Seven Samurai");
  });
});
