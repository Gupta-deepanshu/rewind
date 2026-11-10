/**
 * The little the browser needs to know about the clerk. No imports on purpose: the counter is a
 * client component, and anything imported here ships to the browser (the system prompt must not).
 */

/** Longest request the clerk will read; longer ones are refused before any model call. */
export const MAX_QUERY_LENGTH = 200;

/** The clerk page for a request, before anything is resolved. */
export const askHref = (q: string) => `/search/ai?${new URLSearchParams({ q }).toString()}`;
