/** @jest-environment node */
import { chipsFor } from "./chips";
import { emptyFilters, type Filters } from "./schema";

const all: Filters = {
  genres: [{ id: 53, name: "Thriller" }],
  keywords: [{ id: 10051, name: "heist" }],
  people: [
    { id: 525, name: "Christopher Nolan", role: "crew" },
    { id: 3895, name: "Michael Caine", role: "cast" },
  ],
  language: "ko",
  releasedFrom: "1990-01-01",
  releasedTo: "1999-12-31",
  runtimeMax: 120,
  minRating: 7.5,
  minVotes: 1000,
  sort: "best_rated",
};

describe("chipsFor", () => {
  it("makes one chip per filter, people first", () => {
    expect(chipsFor(all).map((c) => [c.kind, c.label])).toEqual([
      ["filmmaker", "By Christopher Nolan"],
      ["actor", "With Michael Caine"],
      ["genre", "Thriller"],
      ["theme", "Heist"],
      ["language", "Korean"],
      ["release dates", "1990s"],
      ["running time", "Under 120 min"],
      ["rating", "Rated 7.5+"],
      ["number of votes", "1,000+ votes"],
      ["sort order", "Best rated first"],
    ]);
  });

  it("each chip's filters are everything except that chip", () => {
    const chips = chipsFor(all);
    const caine = chips.find((c) => c.label === "With Michael Caine")!;
    expect(caine.without).toEqual({ ...all, people: [all.people[0]] });
    const dates = chips.find((c) => c.kind === "release dates")!;
    expect(dates.without).not.toHaveProperty("releasedFrom");
    expect(dates.without).not.toHaveProperty("releasedTo");
    expect(dates.without.runtimeMax).toBe(120);
  });

  it("labels other date ranges and runtimes", () => {
    const label = (f: Partial<Filters>) => chipsFor({ ...emptyFilters(), ...f }).map((c) => c.label);
    expect(label({ releasedFrom: "2021-11-10", releasedTo: "2026-11-10" })).toEqual(["2021–2026"]);
    expect(label({ releasedFrom: "1998-01-01", releasedTo: "1998-12-31" })).toEqual(["1998"]);
    expect(label({ releasedTo: "1979-12-31" })).toEqual(["Up to 1979"]);
    expect(label({ runtimeMin: 90, runtimeMax: 100 })).toEqual(["90–100 min"]);
    expect(label({ runtimeMin: 150 })).toEqual(["Over 150 min"]);
  });

  it("has no chips for no filters", () => {
    expect(chipsFor(emptyFilters())).toEqual([]);
  });
});
