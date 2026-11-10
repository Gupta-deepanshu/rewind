/** @jest-environment node */
import { isEmpty, MAX_LIST, sanitizeFilters } from "./schema";

describe("sanitizeFilters", () => {
  it("keeps a fully valid answer as it is", () => {
    const raw = {
      genres: [{ id: 80, name: "Crime" }],
      keywords: [{ id: 10051, name: "heist" }],
      people: [{ id: 525, name: "Christopher Nolan", role: "crew" }],
      releasedFrom: "1990-01-01",
      releasedTo: "1999-12-31",
      runtimeMin: 80,
      runtimeMax: 120,
      minRating: 7.5,
      minVotes: 500,
      language: "en",
      sort: "best_rated",
    };
    expect(sanitizeFilters(raw)).toEqual({ filters: raw, dropped: [] });
  });

  it("treats missing and null fields as not set, without complaining", () => {
    const { filters, dropped } = sanitizeFilters({ genres: null, minRating: null });
    expect(filters).toEqual({ genres: [], keywords: [], people: [] });
    expect(dropped).toEqual([]);
  });

  it("never throws on garbage, and ignores unknown keys", () => {
    for (const raw of [undefined, null, 42, "nope", [], { hack: "<script>" }]) {
      expect(sanitizeFilters(raw).filters).toEqual({ genres: [], keywords: [], people: [] });
    }
  });

  it("drops only the invalid field and says which part was left out", () => {
    const { filters, dropped } = sanitizeFilters({
      genres: [{ id: 16, name: "Animation" }],
      minRating: 75, // out of 10, not 100
      language: "Korean", // must be an ISO code
      releasedFrom: "2021-02-30", // not a real date
    });
    expect(filters).toEqual({ genres: [{ id: 16, name: "Animation" }], keywords: [], people: [] });
    expect(dropped.map((d) => d.what)).toEqual(["the release dates", "the rating", "the language"]);
  });

  it("drops a single bad list item but keeps the rest, naming the bad one", () => {
    const { filters, dropped } = sanitizeFilters({
      people: [
        { id: 3895, name: "Michael Caine", role: "cast" },
        { id: -1, name: "Made Up Person", role: "cast" },
        { id: 525, name: "Christopher Nolan", role: "director" }, // role must be cast or crew
      ],
    });
    expect(filters.people).toEqual([{ id: 3895, name: "Michael Caine", role: "cast" }]);
    expect(dropped.map((d) => d.what)).toEqual(['"Made Up Person"', '"Christopher Nolan"']);
  });

  it("keeps each id once and caps every list", () => {
    const genres = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `G${i}` }));
    const { filters, dropped } = sanitizeFilters({ genres: [...genres, genres[0]] });
    expect(filters.genres).toHaveLength(MAX_LIST);
    expect(dropped).toEqual([{ field: "genres", what: "some of the genres" }]);
  });

  it("drops a backwards range as a whole, and mentions it once", () => {
    const { filters, dropped } = sanitizeFilters({
      releasedFrom: "2010-01-01",
      releasedTo: "2000-01-01",
      runtimeMin: 150,
      runtimeMax: 90,
    });
    expect(filters).toEqual({ genres: [], keywords: [], people: [] });
    expect(dropped.map((d) => d.what)).toEqual(["the release dates", "the running time"]);
  });

  it("rejects fractional runtimes and unknown sorts", () => {
    const { filters, dropped } = sanitizeFilters({ runtimeMax: 119.5, sort: "random" });
    expect(filters.runtimeMax).toBeUndefined();
    expect(filters.sort).toBeUndefined();
    expect(dropped.map((d) => d.what)).toEqual(["the running time", "the sort order"]);
  });
});

describe("isEmpty", () => {
  it("is true with no filters, even with a sort", () => {
    expect(isEmpty({ genres: [], keywords: [], people: [], sort: "newest" })).toBe(true);
  });

  it("is false once anything narrows the search", () => {
    expect(isEmpty({ genres: [], keywords: [], people: [], minRating: 0 })).toBe(false);
    expect(isEmpty({ genres: [{ id: 1, name: "x" }], keywords: [], people: [] })).toBe(false);
  });
});
