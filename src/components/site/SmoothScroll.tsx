"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { registerLenis } from "@/lib/scroll";

/**
 * Lenis smooth scrolling for the whole page.
 * - Turns itself off for people who ask for reduced motion (Lenis default).
 * - Same-page anchor links (#aisle-…, #back) glide instead of jumping; the offset matches
 *   the 24px scroll-margin-top the sections already use.
 * - Sideways swipes are left alone on elements marked `data-lenis-prevent-horizontal`
 *   (the turning shelf and the spine rows), so they still scroll on their own.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      anchors: { offset: -24 },
    });
    registerLenis(lenis);
    return () => {
      registerLenis(null);
      lenis.destroy();
    };
  }, []);

  return null;
}
