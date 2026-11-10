/** @jest-environment node */
import { createLookupTools, MAX_LOOKUPS, Resolved, type Lookups } from "./tools";

const fakeLookups = (over: Partial<Lookups> = {}): Lookups => ({
  genres: jest.fn(async () => [
    { id: 80, name: "Crime" },
    { id: 16, name: "Animation" },
  ]),
  people: jest.fn(async (name: string) =>
    name.toLowerCase().includes("caine") ? [{ id: 3895, name: "Michael Caine", knownFor: "Acting", knownTitles: ["The Prestige"] }] : [],
  ),
  keywords: jest.fn(async () => [{ id: 10051, name: "heist" }]),
  ...over,
});

/** Calls a tool the way the AI SDK would. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (t: { execute?: (...args: any[]) => unknown }, input: unknown) =>
  t.execute!(input, { toolCallId: "test", messages: [] }) as Promise<Record<string, unknown>>;

describe("lookup tools", () => {
  it("return what TMDB found and record every id they hand out", async () => {
    const resolved = new Resolved();
    const tools = createLookupTools(fakeLookups(), resolved);

    expect(await call(tools.list_genres, {})).toEqual({ results: [{ id: 80, name: "Crime" }, { id: 16, name: "Animation" }] });
    await call(tools.find_person, { name: "Michael Caine" });
    await call(tools.find_keyword, { term: "heist" });

    expect(resolved.name("genres", 80)).toBe("Crime");
    expect(resolved.name("people", 3895)).toBe("Michael Caine");
    expect(resolved.name("keywords", 10051)).toBe("heist");
  });

  it("know nothing about ids no tool returned, or ids returned for another kind", async () => {
    const resolved = new Resolved();
    const tools = createLookupTools(fakeLookups(), resolved);
    await call(tools.list_genres, {});
    expect(resolved.name("genres", 99999)).toBeUndefined();
    expect(resolved.name("people", 80)).toBeUndefined(); // 80 is a genre id, not a person
  });

  it("return an empty list for a name TMDB doesn't know", async () => {
    const tools = createLookupTools(fakeLookups(), new Resolved());
    expect(await call(tools.find_person, { name: "Nobody Atall" })).toEqual({ results: [] });
  });

  it("turn a failed lookup into a message for the model instead of throwing", async () => {
    const resolved = new Resolved();
    const tools = createLookupTools(fakeLookups({ people: async () => Promise.reject(new Error("TMDB 500")) }), resolved);
    expect(await call(tools.find_person, { name: "Michael Caine" })).toEqual({ error: expect.stringMatching(/leave this part out/i) });
    expect(resolved.name("people", 3895)).toBeUndefined();
  });

  it("stop looking things up after the per-request budget", async () => {
    const lookups = fakeLookups();
    const tools = createLookupTools(lookups, new Resolved());
    for (let i = 0; i < MAX_LOOKUPS; i++) await call(tools.find_keyword, { term: `t${i}` });
    expect(await call(tools.find_keyword, { term: "one more" })).toEqual({ error: expect.stringMatching(/too many/i) });
    expect(lookups.keywords).toHaveBeenCalledTimes(MAX_LOOKUPS);
    // the budget is per kind: people can still be looked up
    expect(await call(tools.find_person, { name: "Michael Caine" })).toHaveProperty("results");
  });

  it("describe their inputs so the model can't send an empty or huge name", () => {
    const tools = createLookupTools(fakeLookups(), new Resolved());
    const schema = tools.find_person.inputSchema as unknown as { safeParse(v: unknown): { success: boolean } };
    expect(schema.safeParse({ name: "" }).success).toBe(false);
    expect(schema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
    expect(schema.safeParse({ name: "Bong Joon-ho" }).success).toBe(true);
  });
});
