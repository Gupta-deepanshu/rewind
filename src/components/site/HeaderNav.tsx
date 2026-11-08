"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

/** `match` decides which pages count as being "in" that link's section. */
const LINKS = [
  { href: "/aisles", label: "Aisles", match: (p: string) => p.startsWith("/aisles") },
  { href: "/decades", label: "Decades", match: (p: string) => p.startsWith("/decades") },
  { href: "/box-sets", label: "Box Sets", match: (p: string) => p.startsWith("/box-sets") },
  { href: "/new", label: "New Arrivals", match: (p: string) => p === "/new" },
  // a person's page is where the director shelf leads
  { href: "/#directors", label: "Directors", match: (p: string) => p.startsWith("/people") },
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
