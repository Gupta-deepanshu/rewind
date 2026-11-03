import { coverTitleSize, vhsLook, type Art, type Scheme } from "@/lib/vhs";
import styles from "./Cover.module.css";

/**
 * A code-generated VHS box front, sized in em: 17.6em × 33.4em (the VHS box ratio).
 * The parent sets font-size; 10px → 176 × 334 px.
 */
export function Cover({
  title,
  year,
  directorName,
}: {
  title: string;
  year: number;
  directorName?: string;
}) {
  const look = vhsLook(title);
  return (
    <div className={`${styles.cover} ${styles[look.scheme]}`}>
      <span className={styles.by}>
        {directorName ? `${/^[AEIOU]/i.test(directorName) ? "An" : "A"} ${directorName} Film` : "Feature Presentation"}
      </span>
      <span className={styles.title} style={{ fontSize: `${coverTitleSize(title)}em` }}>
        {title}
      </span>
      <CoverArt art={look.art} className={styles.art} />
      <div className={styles.foot}>
        <span className={styles.year}>{year}</span>
        <span className={styles.vhs}>VHS</span>
      </div>
    </div>
  );
}

/** The screen-printed picture on the cover. Also used for the stills on the back of the box. */
export function CoverArt({
  art,
  scheme,
  className = "",
}: {
  art: Art;
  /** Palette, when the art is used outside a cover. */
  scheme?: Scheme;
  className?: string;
}) {
  return (
    <div className={`${styles.artBox} ${styles[art]} ${scheme ? styles[scheme] : ""} ${className}`} aria-hidden="true">
      <div className={styles.a} />
      <div className={styles.b} />
      <div className={styles.c} />
      <div className={styles.d} />
    </div>
  );
}
