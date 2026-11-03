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
