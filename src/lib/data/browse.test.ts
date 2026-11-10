/** @jest-environment node */
import {
  BOX_SET_SEEDS,
  DECADE_GENRES,
  DECADES,
  decadeFromSlug,
  decadeSlug,
  GENRE_AISLES,
  genreAisleById,
  genreAisleBySlug,
} from "./browse";

describe("genre aisles", () => {
  it("have unique ids and slugs", () => {
    expect(new Set(GENRE_AISLES.map((g) => g.id)).size).toBe(GENRE_AISLES.length);
    expect(new Set(GENRE_AISLES.map((g) => g.slug)).size).toBe(GENRE_AISLES.length);
  });

  it("leave out TMDB's TV Movie genre", () => {
    expect(genreAisleById(10770)).toBeUndefined();
  });

  it("are found by id and by slug", () => {
    expect(genreAisleById(18)?.slug).toBe("drama");
    expect(genreAisleBySlug("science-fiction")?.id).toBe(878);
    expect(genreAisleBySlug("nope")).toBeUndefined();
  });

  it("include every genre the decade pages shelve", () => {
    for (const slug of DECADE_GENRES) expect(genreAisleBySlug(slug)).toBeDefined();
  });
});

describe("decades", () => {
  it("run from the 1920s to the 2020s in order", () => {
    expect(DECADES[0]).toBe(1920);
    expect(DECADES.at(-1)).toBe(2020);
    expect([...DECADES].sort((a, b) => a - b)).toEqual(DECADES);
  });

  it("round-trip through their slugs", () => {
    for (const d of DECADES) expect(decadeFromSlug(decadeSlug(d))).toBe(d);
    expect(decadeSlug(1980)).toBe("1980s");
  });

  it("reject slugs that aren't a decade with a shelf", () => {
    expect(decadeFromSlug("1985s")).toBeUndefined(); // not a decade
    expect(decadeFromSlug("1900s")).toBeUndefined(); // no shelf
    expect(decadeFromSlug("1980")).toBeUndefined(); // missing the s
    expect(decadeFromSlug("eighties")).toBeUndefined();
  });
});

describe("box set seeds", () => {
  it("are unique TMDB collection ids", () => {
    expect(new Set(BOX_SET_SEEDS.map((s) => s.id)).size).toBe(BOX_SET_SEEDS.length);
  });
});
