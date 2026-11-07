import type { AisleShelfData } from "@/lib/types";
import { SpineRow } from "../vhs/SpineRow";
import styles from "./AisleShelf.module.css";

export function AisleNav({ aisles }: { aisles: AisleShelfData[] }) {
  return (
    <nav id="aisles" aria-label="Aisles" className={`page ${styles.nav}`}>
      {aisles.map((a) => (
        <a key={a.slug} href={`#aisle-${a.slug}`} className={`lbl ${styles.sign}`}>
          <span className={styles.num}>{a.num}</span>
          <span>{a.name}</span>
        </a>
      ))}
    </nav>
  );
}

export function AisleShelf({ aisle }: { aisle: AisleShelfData }) {
  return (
    <section id={`aisle-${aisle.slug}`} className={`page ${styles.shelf}`} aria-labelledby={`h-${aisle.slug}`}>
      <div className={styles.head}>
        <span className={`lbl ${styles.kicker}`}>Aisle {aisle.num}</span>
        <h2 id={`h-${aisle.slug}`} className={styles.title}>
          {aisle.name}
        </h2>
        <span className={`lbl ${styles.count}`}>{aisle.films.length} tapes</span>
      </div>
      <SpineRow films={aisle.films} label={`${aisle.name} shelf`} />
    </section>
  );
}
