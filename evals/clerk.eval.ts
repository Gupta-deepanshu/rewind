/**
 * The clerk's eval: runs every case in cases.ts through the real model and the real TMDB
 * lookups, and reports how often the filters come out right.
 *
 *   npm run eval                      all cases
 *   npm run eval -- --only nolan      cases whose query contains "nolan"
 *   npm run eval -- --provider google one provider's model (default: the first one the clerk asks)
 *   npm run eval -- --delay 5000      pause between cases, in ms (default 30s, for free-tier limits)
 *
 * It costs real API calls, so it is not part of `npm test` and must not run in CI.
 * Needs GOOGLE_GENERATIVE_AI_API_KEY and a TMDB key in .env.local.
 */
import { interpret, type Interpretation } from "../src/lib/ai-search/interpret";
import { modelsFromEnv } from "../src/lib/ai-search/model";
import { tmdbConfigured, tmdbFindKeywords, tmdbFindPeople, tmdbGenreList } from "../src/lib/sources/tmdb";
import { CASES } from "./cases";
import { score, type FieldResult } from "./score";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/**
 * Gemini's free tier allows 5 requests a minute and a case makes 2–3, so one case every ~30s.
 * It also allows only ~20 requests a day: a full run needs a paid tier, or --only across days.
 */
const DELAY_MS = Number(arg("delay") ?? 30_000);
const ONLY = arg("only")?.toLowerCase();
/** Retries for answers the provider refused (busy, timeout): those say nothing about accuracy. */
const RETRIES = 2;
const RETRY_WAIT_MS = 20_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "—");

async function main() {
  // one model at a time, without failover, so the scores belong to that model
  const wanted = arg("provider")?.toLowerCase();
  const all = modelsFromEnv();
  const choice = wanted ? all.find((m) => m.provider === wanted) : all[0];
  if (!choice) throw new Error(`No model${wanted ? ` for "${wanted}"` : ""}: set GROQ_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in .env.local.`);
  if (!tmdbConfigured()) throw new Error("No TMDB key: set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY in .env.local.");

  const today = new Date().toISOString().slice(0, 10);
  const cases = CASES.filter((c) => !ONLY || c.query.toLowerCase().includes(ONLY));
  console.log(`Clerk eval: ${cases.length} cases, ${choice.label}, ${today}\n`);

  const lookups = { genres: tmdbGenreList, people: (n: string) => tmdbFindPeople(n), keywords: (t: string) => tmdbFindKeywords(t) };
  const results: { query: string; fields: FieldResult[]; ms: number; fallback?: string }[] = [];

  for (const [n, c] of cases.entries()) {
    if (n > 0) await sleep(DELAY_MS);
    let result: Interpretation | undefined;
    let ms = 0;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const started = Date.now();
      result = await interpret(c.query, { models: [choice], lookups, today });
      ms = Date.now() - started;
      if (result.kind !== "fallback" || !["ai_busy", "timeout"].includes(result.reason) || attempt === RETRIES) break;
      console.log(`  … ${result.reason}, retrying in ${RETRY_WAIT_MS / 1000}s`);
      await sleep(RETRY_WAIT_MS);
    }

    if (result!.kind === "fallback" && result!.reason === "ai_quota") {
      console.log(`\nStopped at "${c.query}": the model's daily quota is used up. Run the rest tomorrow (--only).`);
      break;
    }

    const fields = score(result!, c.expect, today);
    const passed = fields.every((f) => f.ok);
    const fallback = result!.kind === "fallback" ? result!.reason : undefined;
    results.push({ query: c.query, fields, ms, fallback });

    console.log(`${passed ? "PASS" : "FAIL"}  ${c.query}  (${(ms / 1000).toFixed(1)}s${fallback ? `, ${fallback}` : ""})`);
    for (const f of fields.filter((x) => !x.ok)) console.log(`        ${f.field}: got ${f.got}, want ${f.want}`);
  }

  // per field: which kinds of filter the model gets right
  const byField = new Map<string, { ok: number; all: number }>();
  for (const f of results.flatMap((r) => r.fields)) {
    const s = byField.get(f.field) ?? { ok: 0, all: 0 };
    s.all++;
    if (f.ok) s.ok++;
    byField.set(f.field, s);
  }

  const answered = results.filter((r) => !r.fallback);
  const passed = results.filter((r) => r.fields.every((f) => f.ok)).length;
  const avg = answered.reduce((t, r) => t + r.ms, 0) / Math.max(1, answered.length);

  console.log("\nBy field");
  for (const [field, s] of byField) console.log(`  ${field.padEnd(18)} ${String(s.ok).padStart(2)}/${s.all}  ${pct(s.ok, s.all)}`);
  console.log(`\nCases passed     ${passed}/${results.length}  ${pct(passed, results.length)}`);
  console.log(`Model answered   ${answered.length}/${results.length} (the rest fell back: busy, timeout or error)`);
  console.log(`Average time     ${(avg / 1000).toFixed(1)}s per answered case`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
