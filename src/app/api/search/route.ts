import { searchFilms } from "@/lib/catalog";

/** GET /api/search?q=… → up to 8 matching films. Keeps the TMDB key on the server. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  const results = await searchFilms(q.slice(0, 100));
  return Response.json({ results });
}
