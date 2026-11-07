"use client";

import { useEffect, useState } from "react";
import type { DirectorShelfData } from "@/lib/types";
import { ParticleButton } from "../site/ParticleButton";
import { SpineRow } from "../vhs/SpineRow";
import styles from "./DirectorShelf.module.css";

export function DirectorShelf({ directors }: { directors: DirectorShelfData[] }) {
  const [index, setIndex] = useState(0);

  // Pick a random director once we are in the browser (random values can't be prerendered).
  useEffect(() => {
    const id = requestAnimationFrame(() => setIndex(Math.floor(Math.random() * directors.length)));
    return () => cancelAnimationFrame(id);
  }, [directors.length]);

  const director = directors[index];
  const another = () => {
    if (directors.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * directors.length);
    setIndex(next);
  };

  return (
    <section id="directors" className={`page ${styles.section}`} aria-labelledby="director-name">
      <div className={styles.panel}>
        <div className={styles.info}>
          <span className={`lbl ${styles.kicker}`}>Director shelf</span>
          <h2 id="director-name" className={styles.name} aria-live="polite">
            {director.name}
          </h2>
          <span className={`lbl ${styles.meta}`}>
            {[`${director.films.length} on the shelf`, `${director.active[0]} – ${director.active[1]}`]
              .filter(Boolean)
              .join(" / ")}
          </span>
          <p className={styles.copy}>Their films in one shelf, in the order they were made. Pull one out to see the box.</p>
          <div className={styles.actions}>
            <ParticleButton className={`lbl ${styles.another}`} onClick={another}>
              ↻ Another director
            </ParticleButton>
          </div>
        </div>
        <div className={styles.shelf}>
          <SpineRow key={director.slug} films={director.films} label={`Films by ${director.name}`} size="sm" dark />
        </div>
      </div>
    </section>
  );
}
