/** @jest-environment node */
import { DEFAULT_MIN_VOTES, RATED_MIN_VOTES, toDiscoverParams } from "./discover";
import { emptyFilters, type Filters } from "./schema";

const TODAY = "2026-11-10";
const f = (extra: Partial<Filters>): Filters => ({ ...emptyFilters(), ...extra });

describe("toDiscoverParams", () => {
  it("with no filters: popular films that are already out", () => {
    expect(toDiscoverParams(emptyFilters(), TODAY)).toEqual({
      sort_by: "popularity.desc",
      "primary_release_date.lte": TODAY,
      "vote_count.gte": DEFAULT_MIN_VOTES,
    });
  });

  it('maps "90s heist movies under two hours, best rated first"', () => {
    const params = toDiscoverParams(
      f({
        keywords: [
          { id: 10051, name: "heist" },
          { id: 207268, name: "heist movie" },
        ],
        releasedFrom: "1990-01-01",
        releasedTo: "1999-12-31",
        runtimeMax: 120,
        sort: "best_rated",
      }),
      TODAY,
    );
    expect(params).toEqual({
      sort_by: "vote_average.desc",
      with_keywords: "10051|207268", // either keyword
      "primary_release_date.gte": "1990-01-01",
      "primary_release_date.lte": "1999-12-31",
      "with_runtime.lte": 120,
      "vote_count.gte": RATED_MIN_VOTES,
    });
  });

  it("needs every genre, cast member and crew member (AND)", () => {
    const params = toDiscoverParams(
      f({
        genres: [
          { id: 16, name: "Animation" },
          { id: 35, name: "Comedy" },
        ],
        people: [
          { id: 525, name: "Christopher Nolan", role: "crew" },
          { id: 3895, name: "Michael Caine", role: "cast" },
          { id: 1892, name: "Matt Damon", role: "cast" },
        ],
      }),
      TODAY,
    );
    expect(params.with_genres).toBe("16,35");
    expect(params.with_cast).toBe("3895,1892");
    expect(params.with_crew).toBe("525");
  });

  it("never asks for films after today, even if the range goes on", () => {
    expect(toDiscoverParams(f({ releasedFrom: "2021-11-10", releasedTo: "2030-12-31" }), TODAY)).toMatchObject({
      "primary_release_date.gte": "2021-11-10",
      "primary_release_date.lte": TODAY,
    });
  });

  it("puts a vote floor under rating filters, unless the user set one", () => {
    expect(toDiscoverParams(f({ minRating: 7.5 }), TODAY)).toMatchObject({
      "vote_average.gte": 7.5,
      "vote_count.gte": RATED_MIN_VOTES,
    });
    expect(toDiscoverParams(f({ minRating: 7.5, minVotes: 1000 }), TODAY)["vote_count.gte"]).toBe(1000);
    expect(toDiscoverParams(f({ minVotes: 0 }), TODAY)["vote_count.gte"]).toBe(0);
  });

  it("maps runtime from both ends, language and every sort", () => {
    expect(toDiscoverParams(f({ runtimeMin: 90, runtimeMax: 100, language: "ko" }), TODAY)).toMatchObject({
      "with_runtime.gte": 90,
      "with_runtime.lte": 100,
      with_original_language: "ko",
    });
    expect(toDiscoverParams(f({ sort: "newest" }), TODAY).sort_by).toBe("primary_release_date.desc");
    expect(toDiscoverParams(f({ sort: "oldest" }), TODAY).sort_by).toBe("primary_release_date.asc");
  });
});
