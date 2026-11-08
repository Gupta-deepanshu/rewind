/** @jest-environment node */
import { idFromSlug, slugify, tmdbSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Seven Samurai")).toBe("seven-samurai");
  });

  it("drops accents", () => {
    expect(slugify("Amélie")).toBe("amelie");
    expect(slugify("Yasujirō Ozu")).toBe("yasujiro-ozu");
  });

  it("spells out & and trims punctuation at the ends", () => {
    expect(slugify("Thriller & Mystery")).toBe("thriller-and-mystery");
    expect(slugify("¡Three Amigos!")).toBe("three-amigos");
  });

  it("returns an empty string for a title with no letters or digits", () => {
    expect(slugify("…")).toBe("");
  });
});

describe("tmdbSlug", () => {
  it("puts the TMDB id first", () => {
    expect(tmdbSlug(346, "Seven Samurai")).toBe("346-seven-samurai");
  });

  it("is just the id when the title has nothing sluggable", () => {
    expect(tmdbSlug(42, "…")).toBe("42");
  });
});

describe("idFromSlug", () => {
  it("reads the id from a TMDB slug", () => {
    expect(idFromSlug("346-seven-samurai")).toBe(346);
    expect(idFromSlug("42")).toBe(42);
  });

  it("is undefined for an example-data slug", () => {
    expect(idFromSlug("seven-samurai")).toBeUndefined();
  });

  it("reads a leading number as an id, even in an example-data slug", () => {
    // known limitation: the example film "2001: A Space Odyssey" would be read as TMDB id 2001
    expect(idFromSlug("2001-a-space-odyssey")).toBe(2001);
  });

  it("round-trips with tmdbSlug", () => {
    expect(idFromSlug(tmdbSlug(5026, "Akira Kurosawa"))).toBe(5026);
  });
});
