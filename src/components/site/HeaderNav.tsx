"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

/**
 * `match` decides which pages count as being "in" that link's section. `prefetch: false` is for
 * pages whose rendering costs something: the clerk's page can call the model.
 */
const LINKS: { href: string; label: string; match: (p: string) => boolean; prefetch?: false }[] = [
  { href: "/aisles", label: "Aisles", match: (p: string) => p.startsWith("/aisles") },
  { href: "/decades", label: "Decades", match: (p: string) => p.startsWith("/decades") },
  { href: "/box-sets", label: "Box Sets", match: (p: string) => p.startsWith("/box-sets") },
  { href: "/new", label: "New Arrivals", match: (p: string) => p === "/new" },
  // the homepage's director shelf has no link here (six links don't fit beside the search box);
  // it's on the homepage and in the search palette
  { href: "/search/ai", label: "Ask the clerk", match: (p: string) => p.startsWith("/search/ai"), prefetch: false },
];

/** The header's main links; the one for the section you're in is marked. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={styles.nav}>
      {LINKS.map((l) => {
        const current = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch={l.prefetch}
            className={`lbl ${styles.navLink}`}
            aria-current={current ? (pathname === l.href ? "page" : "true") : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
