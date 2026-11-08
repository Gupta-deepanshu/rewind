import type { CreditCard } from "@/lib/types";
import { SlideLink } from "../site/SlideLink";
import { SpineRow } from "../vhs/SpineRow";
import styles from "./Shelf.module.css";

/**
 * A labelled shelf: kicker, serif title, tape count and an optional "walk the aisle" link over
 * one or more rows of spines. `rows` stacks the films onto several shelves (see shelvesOf).
 */
export function Shelf({
  id,
  kicker,
  title,
  films,
  rows,
  count,
  href,
  linkText = "See them all",
  hoverText,
  headingLevel = 2,
}: {
  id: string;
  kicker: string;
  title: string;
  /** One shelf of films. */
  films?: CreditCard[];
  /** Or several shelves, one row each. */
  rows?: CreditCard[][];
  /** Shown as "N tapes". Defaults to how many films are shown. */
  count?: number | string;
  href?: string;
  linkText?: string;
  hoverText?: string;
  headingLevel?: 2 | 3;
}) {
  const shelves = rows ?? (films ? [films] : []);
  const shown = shelves.reduce((n, r) => n + r.length, 0);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const tapes = count ?? `${shown} ${shown === 1 ? "tape" : "tapes"}`;

  return (
    <section id={id} className={`page ${styles.shelf}`} aria-labelledby={`h-${id}`}>
      <div className={styles.head}>
        <span className={`lbl ${styles.kicker}`}>{kicker}</span>
        <Heading id={`h-${id}`} className={styles.title}>
          {title}
        </Heading>
        <span className={`lbl ${styles.count}`}>{tapes}</span>
        {href && <SlideLink className={styles.more} href={href} text={linkText} hoverText={hoverText ?? `${linkText} →`} />}
      </div>
      <div className={styles.rows}>
        {shelves.map((row, i) => (
          <SpineRow key={i} films={row} label={shelves.length > 1 ? `${title}, shelf ${i + 1}` : `${title} shelf`} />
        ))}
      </div>
    </section>
  );
}
