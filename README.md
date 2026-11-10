# Rewind — a film database shelved on VHS

Rewind is a film database (think IMDb) where every film is a worn VHS tape on a shelf.
Browse aisles of spines, pull a tape out to see its cover, and turn the box over to read the cast and credits.

Built with **Next.js 16 (App Router, Cache Components), React 19 and TypeScript**. Film data comes from **TMDB**.

## Features

- **3D staff-pick shelf.** An endless shelf of VHS boxes built with CSS 3D transforms and one `requestAnimationFrame` loop. The centre box turns out to show its cover, leans towards the cursor, and opens its film page with a paper-sheet transition. Drag, click, arrow keys or the buttons to browse.
- **Code-generated VHS art.** Every spine and cover is drawn in CSS from the film's title, so any film from the API gets a consistent, unique tape. No images needed.
- **Film pages with a "back of the box".** Tagline, stills, the dense billing block, a barcode and the top-billed cast. Cast photos and stills are recoloured into a two-colour screen-print look with CSS blend modes.
- **Aisles and a random director shelf.** Now playing, top drama, top thriller and mystery, and a director's filmography as a shelf.
- **Live search** through a server route, so the API key never reaches the browser.
- **Ask the clerk.** Ask for films in plain English ("Korean thrillers from the last five years") and an AI clerk turns it into TMDB filters, shows what it understood as removable chips, and puts the results on the shelf. See [AI Search](#ai-search).
- **Works without a key.** If no TMDB key is set, or TMDB is down, the site falls back to built-in example data.

## Running it

```bash
npm install
cp .env.example .env.local   # optional: add a TMDB key for live data
npm run dev
```

Open http://localhost:3000.

### TMDB key (optional)

Get a free key at https://www.themoviedb.org/settings/api and put **one** of these in `.env.local`:

```
TMDB_READ_ACCESS_TOKEN=...   # the long "API Read Access Token" (preferred)
TMDB_API_KEY=...             # or the short "API Key"
```

The app calls `api.tmdb.org`, TMDB's alternative host, because `api.themoviedb.org` is blocked by some internet providers. Override it with `TMDB_API_BASE` if needed.

### AI key (optional, for "Ask the clerk")

The clerk runs on free tiers. Add one key, or both, to `.env.local`:

```
GROQ_API_KEY=...                   # https://console.groq.com/keys
GOOGLE_GENERATIVE_AI_API_KEY=...   # https://aistudio.google.com, "Get API key"
AI_PROVIDER=groq                   # optional: which one to ask first (default: groq)
```

With both, the clerk asks the first and moves on to the second when the first is out of quota, busy or down. Neither needs billing. Without a key the clerk still works, with simple rules instead of a model (see [Fallbacks](#fallbacks)). On Vercel, add the same variables under Project → Settings → Environment Variables.

### Tests and evals

```bash
npm test          # Jest: unit and component tests, no network (keys are cleared, the model is mocked)
npx tsc --noEmit  # type-check
npm run eval      # the clerk's eval set against the real model and TMDB (needs an AI key and a TMDB key; not run in CI)
```

## How it's organised

```
src/
  app/                 pages: home, films, people, aisles, decades, box sets, new, /search/ai, /api/*
  components/
    home/              3D staff-pick shelf, aisles, director shelf
    film/              back of the box
    vhs/               generated spine, cover and shelf row
    browse/            shelves, filters and page heads for the browsing pages
    clerk/             the clerk's counter, answer, chips and live announcements
    site/              header, search palette, footer
  lib/
    catalog.ts         the only data entry point the pages use
    ai-search/         the clerk: prompt, schema, tools, filters → TMDB, fallbacks (no Next.js imports)
    sources/tmdb.ts    live data from TMDB (cached with `use cache`)
    sources/local.ts   built-in example data and fallback
    vhs.ts             picks each film's spine and cover look from its title
evals/                 the clerk's eval set and runner (npm run eval)
```

## AI Search

"Ask the clerk" (`/search/ai?q=…`) turns a plain-English request into TMDB filters, searches TMDB's `/discover/movie` with them, and shows the results as tapes, with a one-line comment from the clerk about what it searched for.

### Architecture

```
/search/ai?q=…  (server component, streamed with Suspense)
   │
   ├─ catalog.askTheClerk()          wires the parts below to TMDB, Gemini, the rate limiter and the cache
   │     │
   │     └─ ai-search/clerk.ts       the decisions: cache → rate limit → model → TMDB, and every fallback
   │           ├─ interpret.ts       one model conversation (Vercel AI SDK, generateText + tools)
   │           │     ├─ prompt.ts    system prompt; the request goes in <request> tags as data
   │           │     ├─ tools.ts     list_genres, find_person, find_keyword (TMDB lookups, injected)
   │           │     └─ schema.ts    Zod: validates the answer field by field
   │           ├─ discover.ts        filters → /discover/movie params
   │           └─ rules.ts           rule-based parser for when there is no model
   │
   └─ components/clerk               counter, chips, the clerk's line, the shelf
```

`src/lib/ai-search` has no Next.js imports: its dependencies (the model, the TMDB lookups, the clock, the limiter) are passed in. That is what lets every path in it be unit-tested, and lets the eval runner use it outside Next.js.

**Why a server component, not a route handler or server action.** The page renders the answer on the server inside `<Suspense>`, so the URL is the whole state: results are shareable and survive a refresh, the "searching the shelves…" state streams first, and no client-side fetching or URL syncing is needed. That is the same pattern as the aisle pages. A server action is meant for changing data and its result has no URL. A route handler would have meant fetching on the client and keeping the URL in sync by hand.

### The tool-calling flow

1. The model gets the system prompt, the request in `<request>` tags, and four tools. It must call a tool on every turn (`toolChoice: "required"`), so it can't answer in free text.
2. It looks names up: `list_genres` for genres, `find_person` once per person (candidates come back with what they're known for, to tell namesakes apart), `find_keyword` for themes such as "heist". Lookups run in parallel when the model asks for several at once.
3. It calls `submit_filters` with the filters, an intent (`search`, `vague` or `off_topic`) and its comment. That tool has no `execute`, so calling it ends the conversation. There are at most 6 turns and 15 seconds in all.
4. The answer is checked:
   - **Zod, field by field.** A bad field is dropped, not the whole answer: a rating of 75 or a language of "Korean" loses only that field, and the clerk says which part of the request it couldn't use.
   - **Ids are never guessed.** Every id a tool returns is recorded for the request, and any genre, person or keyword id in the answer that no tool returned is dropped (and named to the customer). Names are replaced with TMDB's spelling.
5. The filters become `/discover/movie` parameters. Genres and people are ANDed ("Nolan films with Caine" needs both); keywords are ORed, because TMDB has near-duplicates ("heist", "heist movie"). Rating and "best rated" searches get a vote floor so a film with three 10/10 votes doesn't win.
6. The filters are shown as chips. Each chip links to the same page with the filters minus that chip in an `f=` parameter, so removing one re-runs only the TMDB search. `f` is untrusted input like anything in a URL: it is length-limited and goes through the same Zod validation.

### Edge cases

- **Vague requests** ("something good") get defaults (popular, rated 7+, 1,000+ votes) and a line saying so.
- **Off-topic requests** get a fixed in-character refusal and no TMDB call.
- **No results:** up to three looser searches are tried, each without one filter (themes first, then rating, running time, dates, language, genres), and the first that finds something is offered as "Try without …". People are never dropped, and "drop everything" is never suggested.
- **Too long:** requests over 200 characters are refused before anything runs (the input has `maxLength` too).

### Safety

- **Keys stay on the server.** All model and TMDB calls run in server code. The counter, a client component, imports only a dependency-free `query.ts`, so neither Zod nor the system prompt ends up in the browser bundle.
- **Prompt injection.** The rules are only in the system prompt; the request is passed as delimited data with `<` and `>` removed, so it can't close its tag. Output is only accepted through the `submit_filters` schema. The off-topic refusal is a fixed line, not the model's words. The model's own comment is shown only if it is one plain line with no links or markup, doesn't contain a marker hidden in the system prompt, and doesn't talk about its instructions; otherwise the clerk's line is written from the filters instead. It is also replaced whenever something was dropped, so the comment never describes a search that didn't happen.
- **Crawlers and prefetching.** Rendering `/search/ai` can call the model, so the page is `noindex, nofollow` and every link to it (nav, chips, examples, suggestions) has `prefetch={false}`.
- **Duplicate submissions.** The counter navigates inside a React transition: the button is disabled while the clerk works, and submitting the request that is already shown does nothing.

### Fallbacks

The clerk always answers, and always says why when it didn't use the model:

```
Groq ── ok ─────────────────────────────────────────────▶ /discover/movie
  │ out of quota · busy · timeout · error · no answer            │ fails
  ▼                                                              ▼
Gemini ── ok ──────────────────────────────▶ (same)   title search for the raw words
  │ same reasons, or no key at all, or this visitor is rate-limited    ▲
  ▼                                                                    │
rules.ts ── understood ──▶ /discover/movie                             │
  └ didn't understand ─────────────────────────────────────────────────┘
```

**Provider failover.** Every provider with a key is asked in turn (`AI_PROVIDER` picks the first; otherwise Groq, then Gemini). Any failure moves on to the next one. A provider with a backup gets 10 seconds and no retry, since the backup is the retry; the last one gets 15 seconds and one retry. Each attempt keeps its own record of looked-up ids, so a failed attempt's ids can't leak into the next. The page sets `maxDuration = 60` so a host allows the worst case.

`rules.ts` understands decades, years and ranges, "the last N years", running times, ratings, genre words, about 20 nationalities and sort words. It doesn't know people or themes; those need the model's lookups. Without a TMDB key, the clerk searches the example shelf by title and never calls the model.

### Cost controls and known limitations

- **Per-IP rate limit:** 10 model calls a minute per visitor (sliding window). Cached answers don't count. Over the limit, the visitor gets the rule-based fallback, not an error.
- **Short cache:** the interpretation of a request is reused for 10 minutes, ignoring case and spacing (and keyed by date, since "the last five years" depends on it). Identical requests arriving together share one model call. Fallbacks aren't cached, so a timeout isn't served to the next visitor.
- **Known limitation: both are in memory, per server instance.** On serverless hosting (Vercel) each instance keeps its own counts and cache, so the real limit is "10 a minute per instance", and a cold start forgets both. The production fix is a shared store, such as Redis via Upstash (`@upstash/ratelimit` for the limiter, the same Redis for the cache). The visitor's IP comes from `x-forwarded-for`, which Vercel sets; on other hosts it must come from a trusted proxy.

### Models and free tiers

The clerk runs on free tiers, so it costs nothing to run: **Groq** (`openai/gpt-oss-120b`, through `@ai-sdk/groq`) first, then **Google Gemini** (`gemini-3.5-flash`, through `@ai-sdk/google`), set with `AI_PROVIDER`, `GROQ_MODEL` and `GOOGLE_MODEL`. `model.ts` is the only file that knows about providers; adding another (Anthropic, OpenAI…) is one entry there and an env change. Nothing else in the clerk changes, which is also what made adding Groq a small change.

Free quota belongs to the API key, so on a public site it is shared by every visitor. Asking two providers in turn gives the site both allowances.

Groq was added because Gemini's free tier turned out to be small: for this model it allowed **5 requests a minute and 20 a day** (Nov 2026; Google changes these, see [ai.dev/rate-limit](https://ai.dev/rate-limit)). A search makes 2–3 model requests (lookups, then the answer), so that is roughly 7–10 AI searches a day. In testing it was also sometimes overloaded (503). The fallback chain is there partly for that: when Gemini says no, the clerk falls back to rules or a title search and says why, including "answered all the questions it can for today" once the daily quota is gone. On Gemini's free tier, expect about 7–9 seconds per AI search (2–3 model turns of 2–3 seconds each); a paid tier or a faster model would cut that. Groq's free tier is limited mainly per minute: for `openai/gpt-oss-120b` it allowed **8,000 tokens a minute**, and a search uses about 4,500 (each request carries the prompt and the tool definitions), so under 2 searches a minute for the whole site; beyond that Groq answers 429 and the clerk asks Gemini. Limits are per model, see console.groq.com/settings/limits. Groq answers fast: about 3 seconds per search.

### Evals

`evals/cases.ts` holds 20 requests with the filters a careful human would pick: the examples above, people, themes, dates, runtimes, ratings, sorting, vague requests, off-topic requests and a prompt-injection attempt. `npm run eval` runs them through the real model and TMDB lookups and reports accuracy per case and per field. It retries cases the provider refused (busy, timeout), since those say nothing about accuracy, and pauses between cases for the free tier's limits. It is not part of `npm test` and shouldn't run in CI.

**Results:** pending a full run. The first run, on Gemini's free tier, passed the 2 cases it finished before the tier's daily quota ran out (which is how that quota was found).

## Credits

Film data and images from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.
