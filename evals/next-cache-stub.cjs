/**
 * Preloaded by `npm run eval`: the real TMDB source calls cacheLife() from next/cache, which
 * only works inside Next.js. Outside it, caching doesn't matter, so these become no-ops and the
 * eval runs the exact lookups production uses.
 */
const path = require.resolve("next/cache");
require.cache[path] = { id: path, filename: path, loaded: true, exports: { cacheLife() {}, cacheTag() {}, revalidateTag() {} } };
