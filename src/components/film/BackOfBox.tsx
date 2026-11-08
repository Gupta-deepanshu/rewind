import Image from "next/image";
import Link from "next/link";
import { ART, vhsLook } from "@/lib/vhs";
import type { Film, FilmDetails } from "@/lib/types";
import { CoverArt } from "../vhs/Cover";
import styles from "./BackOfBox.module.css";

const TONES = ["cobalt", "vermilion", "cream"] as const;

/** Builds the dense credit block printed at the bottom of a VHS box. */
function billingBlock(film: Film, d: FilmDetails): string {
  const [lead1, lead2, ...rest] = d.cast.map((c) => c.name);
  const parts = [
    d.studio ? `A ${d.studio} production` : "",
    [lead1, lead2].filter(Boolean).join(" · "),
    film.directorName ? `in a film by ${film.directorName}` : "",
    `“${film.title}”`,
    rest.length ? `with ${rest.join(" · ")}` : "",
    d.writers.length ? `screenplay by ${d.writers.join(", ")}` : "",
    ...d.crew.map((c) => `${c.job.replace(/ by$/, "").toLowerCase()} by ${c.name}`),
    film.directorName ? `directed by ${film.directorName}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

export function BackOfBox({ film, details }: { film: Film; details: FilmDetails }) {
  const look = vhsLook(film.title);
  const realStills = details.stills ?? [];
  // with no real stills, show the other cover-art styles in the film's palette
  const drawnStills = [1, 2, 3].map((i) => ART[(ART.indexOf(look.art) + i) % ART.length]);

  return (
    <section id="back" className={`page ${styles.section}`} aria-labelledby="back-title">
      <div className={styles.heading}>
        <h2 id="back-title" className={styles.h2}>
          The back of the box
        </h2>
      </div>

      <div className={styles.box}>
        <div className={styles.left}>
          <p className={styles.tagline}>{details.tagline || film.title}</p>
          {details.backCopy && <p className={styles.copy}>{details.backCopy}</p>}
          <div className={styles.stills}>
            {realStills.length > 0
              ? realStills.map((src, i) => (
                  <div key={src} className={`${styles.still} ${styles.photo} ${styles[TONES[i % TONES.length]]}`}>
                    <Image src={src} alt="" fill sizes="(max-width: 767px) 30vw, 200px" />
                  </div>
                ))
              : drawnStills.map((art, i) => (
                  <CoverArt key={i} art={art} scheme={look.scheme} className={styles.still} />
                ))}
          </div>
          <p className={styles.billing}>{billingBlock(film, details)}</p>
          <div className={styles.badges}>
            <div className={styles.barcode} aria-hidden="true" />
            {details.runtime > 0 && <span className={`lbl ${styles.badge}`}>{details.runtime} min</span>}
            {details.colour && <span className={`lbl ${styles.badge}`}>{details.colour}</span>}
            <span className={`lbl ${styles.badge}`}>{details.language}</span>
            {details.language !== "English" && <span className={`lbl ${styles.badge}`}>Subtitled</span>}
            <span className={styles.vhs}>VHS</span>
          </div>
        </div>

        <div className={styles.right}>
          <span className={`lbl ${styles.kicker}`}>Starring</span>
          <ul className={styles.cast}>
            {details.cast.map((c, i) => (
              <li key={`${c.name}-${i}`} className={styles.person}>
                <div className={`${styles.headshot} ${styles[TONES[i % TONES.length]]}`}>
                  {c.photo ? (
                    <Image src={c.photo} alt="" fill sizes="(max-width: 767px) 40vw, 120px" />
                  ) : (
                    <div className={styles.silhouette} aria-hidden="true" />
                  )}
                </div>
                {c.slug ? (
                  <Link href={`/people/${c.slug}`} className={`${styles.name} ${styles.nameLink}`}>
                    {c.name}
                  </Link>
                ) : (
                  <span className={styles.name}>{c.name}</span>
                )}
                <span className={styles.role}>as {c.character}</span>
              </li>
            ))}
          </ul>
          {(details.writers.length > 0 || details.crew.length > 0) && (
            <dl className={styles.crew}>
              {details.writers.length > 0 && (
                <>
                  <dt className="lbl">Written by</dt>
                  <dd>{details.writers.join(", ")}</dd>
                </>
              )}
              {details.crew.map((c) => (
                <div key={c.job} className={styles.crewRow}>
                  <dt className="lbl">{c.job}</dt>
                  <dd>{c.name}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
