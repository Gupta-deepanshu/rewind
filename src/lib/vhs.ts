/**
 * Picks the look of a generated VHS box from the film title, so the same film
 * always gets the same spine and cover.
 */

export const SCHEMES = ["ink", "cream", "cobalt", "red", "forest", "mustard"] as const;
export const MARKS = ["sun", "stripes", "peak", "bar"] as const;
export const ART = ["peaks", "sea", "city"] as const;

export type Scheme = (typeof SCHEMES)[number];
export type Mark = (typeof MARKS)[number];
export type Art = (typeof ART)[number];

function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

export function vhsLook(title: string): { scheme: Scheme; mark: Mark; art: Art } {
  const h = hash(title);
  return {
    scheme: SCHEMES[h % SCHEMES.length],
    mark: MARKS[(h >>> 4) % MARKS.length],
    art: ART[(h >>> 8) % ART.length],
  };
}

/** Spine title size in em: shrink long titles so they fit the spine. */
export function spineTitleSize(title: string): number {
  const len = title.length;
  return len <= 15 ? 1.9 : Math.max(1.05, (1.9 * 15) / len);
}

/** Cover title size in em, based on the longest word and the number of lines. */
export function coverTitleSize(title: string): number {
  const words = title.toUpperCase().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const byWidth = 14.2 / (longest * 0.5);
  const byLines = words.length > 4 ? 3 : words.length > 2 ? 3.6 : 4.3;
  return Math.min(4.3, byWidth, byLines);
}

/* ------------------------------------------------------------------ spines */

/**
 * Spines vary the way a real shelf does: each tape looks like it came from one of several
 * (fictional) distributors with their own spine layout, the decade sets the palette and the
 * layouts in fashion, cases come in slim / standard / wide, and some carry a store sticker.
 * Everything is picked from the title and year, so a film always gets the same spine.
 */
export const SPINE_LAYOUTS = ["classic", "band", "split", "stack", "outline", "edge"] as const;
export const SPINE_SCHEMES = [...SCHEMES, "brown", "teal", "plum"] as const;
const STICKERS = ["dot", "label", "barcode"] as const;
const DISTRIBUTORS = ["REWIND", "NIGHT OWL", "LANTERN", "SILVER REEL", "BIG SKY", "PALOMA"] as const;

export type SpineLayout = (typeof SPINE_LAYOUTS)[number];
export type SpineScheme = (typeof SPINE_SCHEMES)[number];
export type SpineSticker = (typeof STICKERS)[number];

/** What was in fashion on spines in each decade. */
const ERAS: { until: number; layouts: SpineLayout[]; schemes: SpineScheme[] }[] = [
  { until: 1969, layouts: ["classic", "band"], schemes: ["cream", "ink", "forest", "mustard"] },
  { until: 1979, layouts: ["band", "classic", "outline"], schemes: ["mustard", "brown", "forest", "cream"] },
  { until: 1989, layouts: ["outline", "split", "classic"], schemes: ["ink", "red", "cobalt", "plum"] },
  { until: 1999, layouts: ["edge", "split", "stack"], schemes: ["cobalt", "teal", "ink", "red"] },
  { until: Infinity, layouts: ["stack", "edge", "band", "split"], schemes: ["ink", "cream", "teal", "cobalt"] },
];
const ANY_ERA = { layouts: [...SPINE_LAYOUTS], schemes: [...SPINE_SCHEMES] };

export type SpineLook = {
  layout: SpineLayout;
  scheme: SpineScheme;
  mark: Mark;
  /** Case width and height in em (standard 5 × 29.6). */
  width: number;
  height: number;
  sticker?: SpineSticker;
  distributor: string;
  /** Catalogue number printed on some layouts, e.g. "NO-1984". */
  catalogue: string;
  /** Older tapes have sat in shop windows. */
  faded: boolean;
};

/** Stacked horizontal words only work for short titles on a 5em-wide spine. */
const stackable = (title: string) => {
  const words = title.split(/\s+/);
  return words.length <= 4 && Math.max(...words.map((w) => w.length)) <= 7;
};

export function spineLook(title: string, year: number, { fixedSize = false } = {}): SpineLook {
  const h = hash(`${title}|${year}`);
  const era = year > 0 ? ERAS.find((e) => year <= e.until)! : ANY_ERA;
  let layout = era.layouts[h % era.layouts.length];
  if (layout === "stack" && !stackable(title)) layout = "edge";

  // mostly standard cases, some slim ones and some wide clamshells
  const size = (h >>> 6) % 20;
  const [width, height] = fixedSize ? [5, 29.6] : size < 3 ? [4.3, 29.2] : size > 16 ? [6, 30.3] : [5, 29.6];

  const stickerRoll = (h >>> 11) % 10;
  const distributor = DISTRIBUTORS[(h >>> 15) % DISTRIBUTORS.length];
  return {
    layout,
    scheme: era.schemes[(h >>> 3) % era.schemes.length],
    mark: MARKS[(h >>> 9) % MARKS.length],
    width,
    height,
    sticker: stickerRoll < 4 ? STICKERS[stickerRoll % STICKERS.length] : undefined,
    distributor,
    catalogue: `${distributor.slice(0, 2)}-${String(year || (h % 9000) + 1000)}`,
    faded: year > 0 && year < 1990,
  };
}
