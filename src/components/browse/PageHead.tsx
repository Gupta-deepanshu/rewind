import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageHead.module.css";

export type Crumb = { href?: string; label: string };

/** Home / Aisles / Drama: the last crumb is the current page. */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={`page ${styles.crumbs}`}>
      {trail.map((c, i) => (
        <span key={`${c.label}-${i}`} className={styles.crumb}>
          {i > 0 && (
            <span className="lbl" aria-hidden="true">
              /
            </span>
          )}
          {c.href && i < trail.length - 1 ? (
            <Link className="lbl" href={c.href}>
              {c.label}
            </Link>
          ) : (
            <span className={`lbl ${styles.here}`} aria-current="page">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** The top of a browsing page: kicker, big serif title, a line about the page, and room for controls. */
export function PageHead({
  kicker,
  title,
  lede,
  meta,
  visual,
  children,
}: {
  kicker: string;
  /** Text, or something richer (the decade page's split-flap board). */
  title: ReactNode;
  /** Shown in place of the title (which stays for screen readers), e.g. the decade page's split-flap board. */
  visual?: ReactNode;
  lede?: ReactNode;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`page ${styles.head}`}>
      <span className={`lbl ${styles.kicker}`}>{kicker}</span>
      <h1 className={visual ? "sr-only" : styles.title}>{title}</h1>
      {visual && (
        <div className={styles.visual} aria-hidden="true">
          {visual}
        </div>
      )}
      {meta && <span className={`lbl ${styles.meta}`}>{meta}</span>}
      {lede && <p className={styles.lede}>{lede}</p>}
      {children}
    </header>
  );
}
