import type Lenis from "lenis";

/** The page's Lenis instance, registered by SmoothScroll, so other code can glide to a section. */
let lenis: Lenis | null = null;

export function registerLenis(instance: Lenis | null) {
  lenis = instance;
}

/** Glides to the element with this id; falls back to a native jump without Lenis (reduced motion). */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (lenis) lenis.scrollTo(el, { offset: -24 });
  else el.scrollIntoView();
  return true;
}
