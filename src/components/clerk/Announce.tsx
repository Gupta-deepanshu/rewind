"use client";

import { useEffect } from "react";

/** The id of the page's polite live region. It lives outside the streamed parts, so it is always there. */
export const CLERK_STATUS_ID = "clerk-status";

/**
 * Says `message` through the page's live region. A region inserted together with its text is
 * often not announced, so the text goes into a region that was already on the page, after a
 * moment, cleared first so the same words are announced again.
 */
export function Announce({ message }: { message: string }) {
  useEffect(() => {
    const region = document.getElementById(CLERK_STATUS_ID);
    if (!region) return;
    region.textContent = "";
    const t = setTimeout(() => {
      region.textContent = message;
    }, 150);
    return () => clearTimeout(t);
  }, [message]);
  return null;
}
