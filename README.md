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

## How it's organised

```
src/
  app/                 pages: home, /films/[slug], /api/search
  components/
    home/              3D staff-pick shelf, aisles, director shelf
    film/              back of the box
    vhs/               generated spine, cover and shelf row
    site/              header, search, footer
  lib/
    catalog.ts         the only data entry point the pages use
    sources/tmdb.ts    live data from TMDB (cached with `use cache`)
    sources/local.ts   built-in example data and fallback
    vhs.ts             picks each film's spine and cover look from its title
```

## Credits

Film data and images from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.
