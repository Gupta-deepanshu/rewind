import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackOfBox } from "@/components/film/BackOfBox";
import { Cover } from "@/components/vhs/Cover";
import { SpineRow } from "@/components/vhs/SpineRow";
import { getFilmPage, getPrebuiltSlugs } from "@/lib/catalog";
import styles from "./film.module.css";

export async function generateStaticParams() {
  const slugs = await getPrebuiltSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/films/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getFilmPage(slug);
  if (!page) return { title: "Tape not found" };
  const { film } = page;
  return {
    title: film.year ? `${film.title} (${film.year})` : film.title,
    description: film.details?.synopsis || `${film.title} on the Rewind shelf.`,
  };
}

export default function FilmPage({ params }: PageProps<"/films/[slug]">) {
  // Films that weren't built ahead of time show this tape-shaped placeholder while they load.
  return (
    <Suspense fallback={<FilmLoading />}>
      <Film params={params} />
    </Suspense>
  );
}

function FilmLoading() {
  return (
    <section className={`page ${styles.hero}`} aria-busy="true">
      <div className={styles.boxCol}>
        <div className={styles.placeholder} />
      </div>
      <div className={styles.info}>
        <span className="lbl">Fetching the tape from the back room…</span>
      </div>
    </section>
  );
}

async function Film({ params }: Pick<PageProps<"/films/[slug]">, "params">) {
  const { slug } = await params;
  const page = await getFilmPage(slug);
  if (!page) notFound();

  const { film, aisle, more } = page;
  const d = film.details;
  const tags = [
    film.year ? String(film.year) : "",
    d?.runtime ? `${d.runtime} min` : "",
    d?.genres.join(" / ") ?? "",
    d?.language ?? "",
    d?.colour ?? "",
  ].filter(Boolean);

  return (
    <>
      <nav aria-label="Breadcrumb" className={`page ${styles.crumbs}`}>
        <Link className="lbl" href="/">
          Home
        </Link>
        <span className="lbl" aria-hidden="true">
          /
        </span>
        {aisle && (
          <>
            <Link className="lbl" href={`/#aisle-${aisle.slug}`}>
              Aisle {aisle.num} {aisle.name}
            </Link>
            <span className="lbl" aria-hidden="true">
              /
            </span>
          </>
        )}
        <span className={`lbl ${styles.here}`} aria-current="page">
          {film.title}
        </span>
      </nav>

      <section className={`page ${styles.hero}`}>
        <div className={styles.boxCol}>
          <div className={styles.box}>
            <Cover title={film.title} year={film.year} directorName={film.directorName} />
          </div>
          {d && (
            <a className={`lbl ${styles.flip}`} href="#back">
              ↻ Turn to the back of the box
            </a>
          )}
        </div>

        <div className={styles.info}>
          {d?.originalTitle && (
            <span className={`lbl ${styles.kicker}`}>
              {d.originalTitleLatin ? `${d.originalTitleLatin} / ` : ""}
              {d.originalTitle}
            </span>
          )}
          <h1 className={styles.title}>{film.title}</h1>
          <ul className={styles.tags} aria-label="Facts">
            {tags.map((t) => (
              <li key={t} className="lbl">
                {t}
              </li>
            ))}
            {d?.rating !== undefined && (
              <li className={`lbl ${styles.rating}`}>
                ★ {d.rating.toFixed(1)} / 10
                {d.voteCount ? <span className={styles.votes}>{d.voteCount.toLocaleString("en")} votes</span> : null}
              </li>
            )}
          </ul>

          {d ? (
            <>
              {d.synopsis && <p className={styles.synopsis}>{d.synopsis}</p>}
              <dl className={styles.facts}>
                {film.directorName && (
                  <>
                    <dt className="lbl">Director</dt>
                    <dd>{film.directorName}</dd>
                  </>
                )}
                {d.writers.length > 0 && (
                  <>
                    <dt className="lbl">Writers</dt>
                    <dd>{d.writers.join(", ")}</dd>
                  </>
                )}
                {d.cast.length > 0 && (
                  <>
                    <dt className="lbl">Starring</dt>
                    <dd>
                      {d.cast
                        .slice(0, 3)
                        .map((c) => c.name)
                        .join(", ")}
                    </dd>
                  </>
                )}
                {d.studio && (
                  <>
                    <dt className="lbl">Studio</dt>
                    <dd>{d.studio}</dd>
                  </>
                )}
              </dl>
              <div className={styles.actions}>
                {d.trailerUrl && (
                  <a className="lbl btn btn-solid" href={d.trailerUrl} target="_blank" rel="noreferrer">
                    ▶ Watch trailer
                  </a>
                )}
                <a className={`lbl btn ${d.trailerUrl ? "" : "btn-solid"}`} href="#back">
                  Cast &amp; credits ↓
                </a>
              </div>
            </>
          ) : (
            <>
              {film.directorName && (
                <dl className={styles.facts}>
                  <dt className="lbl">Director</dt>
                  <dd>{film.directorName}</dd>
                </dl>
              )}
              <p className={styles.pending}>
                This tape is on the shelf, but its synopsis, cast and credits haven’t been filed yet. Connect the TMDB
                API to fill them in.
              </p>
            </>
          )}
        </div>
      </section>

      {d && <BackOfBox film={film} details={d} />}

      {more && more.films.length > 0 && (
        <section className={`page ${styles.more}`} aria-labelledby="more-title">
          <div className={styles.moreHead}>
            <span className={`lbl ${styles.kicker}`}>{more.kicker}</span>
            <h2 id="more-title" className={styles.moreTitle}>
              {more.title}
            </h2>
          </div>
          <SpineRow films={more.films} label={more.title} />
        </section>
      )}
    </>
  );
}
