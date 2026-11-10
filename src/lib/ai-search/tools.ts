import { tool } from "ai";
import { z } from "zod";
import type { Genre, Keyword } from "./schema";

/**
 * The lookup tools the model uses to turn names into TMDB ids. The model is never trusted to
 * know an id: every id the tools hand out is recorded in `Resolved`, and the final filters may
 * only use ids recorded there (see interpret.ts).
 *
 * The lookups themselves are passed in, so this module doesn't depend on TMDB or Next.js and
 * tests can give it fakes.
 */

export type PersonCandidate = { id: number; name: string; knownFor: string; knownTitles: string[] };

export type Lookups = {
  genres(): Promise<Genre[]>;
  people(name: string): Promise<PersonCandidate[]>;
  keywords(term: string): Promise<Keyword[]>;
};

export type Kind = "genres" | "people" | "keywords";

/** Ids the tools have returned during one request, with the name TMDB gave each. */
export class Resolved {
  private readonly ids: Record<Kind, Map<number, string>> = { genres: new Map(), people: new Map(), keywords: new Map() };

  add(kind: Kind, items: { id: number; name: string }[]) {
    for (const i of items) this.ids[kind].set(i.id, i.name);
  }

  /** TMDB's name for an id, if a tool returned it; undefined means the id was never looked up. */
  name(kind: Kind, id: number): string | undefined {
    return this.ids[kind].get(id);
  }
}

/** How many lookups of one kind a single request may make, so a looping model can't spam TMDB. */
export const MAX_LOOKUPS = 6;

const FAILED = { error: "The lookup failed. Leave this part out of the filters." } as const;

export function createLookupTools(lookups: Lookups, resolved: Resolved) {
  const used: Record<Kind, number> = { genres: 0, people: 0, keywords: 0 };

  /** Runs one lookup within its budget, records what it found, and never throws at the model. */
  async function run<T extends { id: number; name: string }>(kind: Kind, find: () => Promise<T[]>) {
    if (++used[kind] > MAX_LOOKUPS) return { error: "Too many lookups. Use what you have found." } as const;
    try {
      const found = await find();
      resolved.add(kind, found);
      return { results: found };
    } catch {
      return FAILED;
    }
  }

  return {
    list_genres: tool({
      description: "List every TMDB movie genre with its id. Call this before using any genre.",
      inputSchema: z.object({}),
      execute: () => run("genres", () => lookups.genres()),
    }),

    find_person: tool({
      description:
        "Find a film person (actor, director, writer, composer…) by name. Returns up to 5 candidates, best known first, " +
        "with what they are known for so you can pick the right one. Call once per person.",
      inputSchema: z.object({ name: z.string().trim().min(1).max(80).describe("The person's name, e.g. Michael Caine") }),
      execute: ({ name }) => run("people", () => lookups.people(name)),
    }),

    find_keyword: tool({
      description:
        "Find TMDB keywords for a theme or subject that is not a genre (heist, time travel, feel-good, road trip…). " +
        "Returns matching keywords with ids, exact matches first.",
      inputSchema: z.object({ term: z.string().trim().min(1).max(60).describe("One theme, e.g. heist") }),
      execute: ({ term }) => run("keywords", () => lookups.keywords(term)),
    }),
  };
}

export type LookupTools = ReturnType<typeof createLookupTools>;
