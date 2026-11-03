import Link from "next/link";
import { dataSource } from "@/lib/catalog";
import styles from "./SiteFooter.module.css";

const AISLE_LINKS = [
  ["new-arrivals", "New Arrivals"],
  ["drama", "Drama"],
  ["thriller-mystery", "Thriller & Mystery"],
] as const;

export function SiteFooter() {
  const tmdb = dataSource() === "tmdb";
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.cols}`}>
        <div className={styles.brand}>
          <span className={styles.mark}>REWIND</span>
          <p className={styles.tag}>Every film, cast and crew, shelved on VHS. Be kind, rewind.</p>
        </div>
        <div className={styles.col}>
          <span className="lbl">Aisles</span>
          {AISLE_LINKS.map(([slug, name]) => (
            <Link key={slug} className="lbl" href={`/#aisle-${slug}`}>
              {name}
            </Link>
          ))}
        </div>
        <div className={styles.col}>
          <span className="lbl">Browse</span>
          <Link className="lbl" href="/#staff-picks">
            Staff Picks
          </Link>
          <Link className="lbl" href="/#directors">
            Directors
          </Link>
        </div>
      </div>
      <div className={`page ${styles.base}`}>
        <span className="lbl">© Rewind. A portfolio project.</span>
        {tmdb ? (
          <a className={`lbl ${styles.credit}`} href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            Film data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
          </a>
        ) : (
          <span className="lbl">Film data: example data (add a TMDB key for live data)</span>
        )}
      </div>
    </footer>
  );
}
