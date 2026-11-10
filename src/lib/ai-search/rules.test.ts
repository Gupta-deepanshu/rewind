/** @jest-environment node */
import { describeFilters } from "./comment";
import { parseWithRules } from "./rules";
import { emptyFilters } from "./schema";

const TODAY = "2026-11-10";
const parse = (q: string) => parseWithRules(q, TODAY);

describe("parseWithRules", () => {
  it.each([
    ["90s heist movies under two hours", { releasedFrom: "1990-01-01", releasedTo: "1999-12-31", runtimeMax: 120 }],
    ["1980s horror", { releasedFrom: "1980-01-01", releasedTo: "1989-12-31", genres: [{ id: 27, name: "Horror" }] }],
    ["films from the 2010s", { releasedFrom: "2010-01-01", releasedTo: "2019-12-31" }],
    ["Korean thrillers from the last five years", { language: "ko", releasedFrom: "2021-11-10", releasedTo: TODAY, genres: [{ id: 53, name: "Thriller" }] }],
    ["westerns after 1960", { releasedFrom: "1961-01-01", genres: [{ id: 37, name: "Western" }] }],
    ["comedies before 1980", { releasedTo: "1979-12-31" }],
    ["a war film from 1998", { releasedFrom: "1998-01-01", releasedTo: "1998-12-31" }],
    ["dramas from 1998 onwards", { releasedFrom: "1998-01-01" }],
    ["crime between 1995 and 2003", { releasedFrom: "1995-01-01", releasedTo: "2003-12-31" }],
    ["sci-fi over 150 minutes", { runtimeMin: 150, genres: [{ id: 878, name: "Science Fiction" }] }],
    ["anything under 90 mins", { runtimeMax: 90 }],
    ["horror rated above 7.5", { minRating: 7.5 }],
    ["something 8+", { minRating: 8 }],
  ])("%s", (q, expected) => {
    const { filters, understood } = parse(q);
    expect(understood).toBe(true);
    expect(filters).toMatchObject(expected);
  });

  it("reads several genre words and the sort", () => {
    expect(parse("feel-good animated comedies, best first").filters).toMatchObject({
      genres: [
        { id: 16, name: "Animation" },
        { id: 35, name: "Comedy" },
      ],
      sort: "best_rated",
    });
    expect(parse("the latest anime").filters.sort).toBe("newest");
  });

  it("doesn't mistake a rating for a year, or a decade for a single year", () => {
    expect(parse("rated 7").filters.releasedFrom).toBeUndefined();
    expect(parse("1990s").filters).toMatchObject({ releasedFrom: "1990-01-01", releasedTo: "1999-12-31" });
  });

  it("understands nothing in a request it has no rule for", () => {
    expect(parse("Christopher Nolan films with Michael Caine")).toEqual({ filters: emptyFilters(), understood: false });
    expect(parse("something good").understood).toBe(false);
  });
});

describe("describeFilters", () => {
  it("writes the clerk's line from the filters", () => {
    expect(describeFilters(parse("Korean thrillers from the last five years, best rated").filters)).toBe(
      "Pulled Korean thriller films from 2021 to 2026, best rated first.",
    );
    expect(describeFilters(parse("90s comedies under two hours").filters)).toBe("Pulled comedy films from the 1990s under 120 minutes, most popular first.");
  });

  it("names people and keywords", () => {
    expect(
      describeFilters({
        ...emptyFilters(),
        keywords: [
          { id: 1, name: "Heist" },
          { id: 2, name: "heist movie" },
        ],
        people: [
          { id: 525, name: "Christopher Nolan", role: "crew" },
          { id: 3895, name: "Michael Caine", role: "cast" },
          { id: 6193, name: "Leonardo DiCaprio", role: "cast" },
        ],
        minRating: 7.5,
        sort: "newest",
      }),
    ).toBe("Pulled heist/heist movie films by Christopher Nolan with Michael Caine and Leonardo DiCaprio rated 7.5+, newest first.");
  });

  it("describes no filters at all", () => {
    expect(describeFilters(emptyFilters())).toBe("Pulled films, most popular first.");
  });
});
