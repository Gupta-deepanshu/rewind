import { searchAll } from "@/lib/catalog";

/**
 * GET /api/search?q=… → up to 8 matching films, 4 people and 3 box sets. Keeps the TMDB key on
 * the server. `results` (the films) keeps its old name.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [], people: [], boxSets: [] });
  const { films, people, boxSets } = await searchAll(q.slice(0, 100));
  return Response.json({ results: films, people, boxSets });
}
