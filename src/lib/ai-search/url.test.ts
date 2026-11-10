/** @jest-environment node */
import { emptyFilters, type Filters } from "./schema";
import { clerkHref, decodeFilters, encodeFilters, MAX_F_LENGTH } from "./url";

const nolan: Filters = {
  ...emptyFilters(),
  people: [
    { id: 525, name: "Christopher Nolan", role: "crew" },
    { id: 39, name: "Penélope Cruz", role: "cast" }, // non-ASCII survives the trip
  ],
  minRating: 7,
  sort: "best_rated",
};

describe("filters in the URL", () => {
  it("round-trips through encode and decode", () => {
    expect(decodeFilters(encodeFilters(nolan))).toEqual({ filters: nolan, dropped: [] });
  });

  it("is URL-safe without escaping, and leaves out empty fields", () => {
    const f = encodeFilters(nolan);
    expect(f).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeFilters(emptyFilters())).toBe("e30"); // "{}"
  });

  it("treats a missing f as 'ask the clerk' and a broken one as not ours", () => {
    expect(decodeFilters(undefined)).toBeUndefined();
    expect(decodeFilters("not base64!")).toBeUndefined();
    expect(decodeFilters("bm90IGpzb24")).toBeUndefined(); // "not json"
    expect(decodeFilters("WzFd")).toBeUndefined(); // "[1]"
    expect(decodeFilters("A".repeat(MAX_F_LENGTH + 1))).toBeUndefined();
  });

  it("validates a hand-edited f like any other untrusted input", () => {
    const tampered = encodeFilters({ ...emptyFilters(), minRating: 99 } as Filters);
    expect(decodeFilters(tampered)).toEqual({
      filters: emptyFilters(),
      dropped: [{ field: "minRating", what: "the rating" }],
    });
  });

  it("builds the clerk page's address", () => {
    expect(clerkHref("90s heist & more")).toBe("/search/ai?q=90s+heist+%26+more");
    const href = new URL(clerkHref("nolan", nolan), "http://x");
    expect(decodeFilters(href.searchParams.get("f")!)?.filters).toEqual(nolan);
  });
});
