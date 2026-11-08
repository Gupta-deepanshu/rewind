/** @jest-environment node */
import { searchAll, getRandomFilm } from "@/lib/catalog";
import { GET as search } from "./search/route";
import { GET as surprise } from "./surprise/route";

jest.mock("@/lib/catalog", () => ({
  searchAll: jest.fn(),
  getRandomFilm: jest.fn(),
}));
jest.mock("next/server", () => ({ connection: jest.fn(async () => {}) }));

const searchAllMock = searchAll as jest.MockedFunction<typeof searchAll>;
const randomMock = getRandomFilm as jest.MockedFunction<typeof getRandomFilm>;

const request = (q: string) => new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`);

describe("GET /api/search", () => {
  beforeEach(() => searchAllMock.mockReset());

  it("answers nothing for fewer than 2 characters, without searching", async () => {
    const res = await search(request(" a "));
    expect(await res.json()).toEqual({ results: [], people: [], boxSets: [] });
    expect(searchAllMock).not.toHaveBeenCalled();
  });

  it("returns films as `results`, with people and box sets", async () => {
    searchAllMock.mockResolvedValue({
      films: [{ slug: "1-a", title: "A", year: 2000 }],
      people: [{ slug: "2-b", name: "B" }],
      boxSets: [{ slug: "3-c", name: "C" }],
    });
    const res = await search(request("  nolan "));
    expect(searchAllMock).toHaveBeenCalledWith("nolan");
    expect(await res.json()).toEqual({
      results: [{ slug: "1-a", title: "A", year: 2000 }],
      people: [{ slug: "2-b", name: "B" }],
      boxSets: [{ slug: "3-c", name: "C" }],
    });
  });

  it("cuts very long queries to 100 characters", async () => {
    searchAllMock.mockResolvedValue({ films: [], people: [], boxSets: [] });
    await search(request("x".repeat(500)));
    expect(searchAllMock.mock.calls[0][0]).toHaveLength(100);
  });
});

describe("GET /api/surprise", () => {
  it("returns a random film and is never cached", async () => {
    randomMock.mockResolvedValue({ slug: "238-the-godfather", title: "The Godfather", year: 1972 });
    const res = await surprise();
    expect(await res.json()).toEqual({ slug: "238-the-godfather", title: "The Godfather" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
