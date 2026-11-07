import type { Film, FilmDetails } from "@/lib/types";
import styles from "./BoxBack.module.css";

/**
 * The printed back of the VHS case, the same size as the cover (17.6em × 33.4em): tagline, blurb,
 * top billing, the small print and a barcode. The full credits are in BackOfBox further down.
 */
export function BoxBack({ film, details }: { film: Film; details: FilmDetails }) {
  const starring = details.cast.slice(0, 4).map((c) => c.name);
  const facts = [
    film.year ? String(film.year) : "",
    details.runtime ? `${details.runtime} min` : "",
    details.colour ?? "",
    details.rating !== undefined ? `★ ${details.rating.toFixed(1)}` : "",
  ].filter(Boolean);
  const blurb = details.backCopy || details.synopsis;

  return (
    <div className={styles.back}>
      <div className={styles.band}>
        <span>Rewind Video</span>
        <span>Hi-Fi Stereo</span>
      </div>

      <div className={styles.body}>
        {details.tagline && <p className={styles.tagline}>{details.tagline}</p>}
        {blurb && <p className={styles.blurb}>{blurb}</p>}

        {starring.length > 0 && (
          <div className={styles.billing}>
            <span className={styles.small}>Starring</span>
            <span className={styles.names}>{starring.join(" · ")}</span>
          </div>
        )}
        {film.directorName && (
          <div className={styles.billing}>
            <span className={styles.small}>Directed by</span>
            <span className={styles.names}>{film.directorName}</span>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        <ul className={styles.facts}>
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className={styles.codeRow}>
          <div className={styles.barcode} aria-hidden="true" />
          <span className={styles.vhs}>VHS</span>
        </div>
      </div>
    </div>
  );
}
