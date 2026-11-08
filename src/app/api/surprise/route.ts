import { connection } from "next/server";
import { getRandomFilm } from "@/lib/catalog";

/** GET /api/surprise → a random well-rated film's slug, picked fresh on every request. */
export async function GET() {
  // random on every call, so this must never be prerendered
  await connection();
  const film = await getRandomFilm();
  return Response.json({ slug: film.slug, title: film.title }, { headers: { "cache-control": "no-store" } });
}
