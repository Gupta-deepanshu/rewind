import { askHref } from "./query";
import { emptyFilters, sanitizeFilters, type Dropped, type Filters } from "./schema";

/**
 * The resolved filters travel in the URL (`/search/ai?q=…&f=…`), so removing a chip or sharing
 * a link re-runs the TMDB search without asking the model again.
 *
 * `f` is base64url-encoded JSON. It comes from the address bar, so it is untrusted: it is
 * length-limited and goes through the same field-by-field validation as the model's answer.
 */

export const MAX_F_LENGTH = 2000;

const toBase64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** Only the fields that are set, so URLs stay short. */
export function encodeFilters(f: Filters): string {
  const compact = Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  );
  return toBase64Url(JSON.stringify(compact));
}

/** The filters in an `f` parameter, or undefined if it is missing or not ours at all. */
export function decodeFilters(raw: string | undefined): { filters: Filters; dropped: Dropped[] } | undefined {
  if (raw === undefined) return undefined;
  if (raw === "") return { filters: emptyFilters(), dropped: [] };
  if (raw.length > MAX_F_LENGTH || !/^[A-Za-z0-9_-]+$/.test(raw)) return undefined;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return sanitizeFilters(parsed);
  } catch {
    return undefined;
  }
}

/** The clerk page's address for a query, with already-resolved filters when we have them. */
export function clerkHref(q: string, filters?: Filters): string {
  return filters ? `${askHref(q)}&f=${encodeFilters(filters)}` : askHref(q);
}
