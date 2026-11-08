import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackOfBox } from "@/components/film/BackOfBox";
import { BoxBack } from "@/components/film/BoxBack";
import { FlipBox } from "@/components/film/FlipBox";
import { ParticleLink } from "@/components/site/ParticleButton";
import { SlideLink } from "@/components/site/SlideLink";
import { Cover } from "@/components/vhs/Cover";
import { SpineRow } from "@/components/vhs/SpineRow";
import { getDecades, getFilmPage, getPrebuiltSlugs } from "@/lib/catalog";
import { decadeSlug } from "@/lib/data/browse";
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
  // the year opens its decade and each genre with an aisle opens the aisle
  const decade = Math.floor(film.year / 10) * 10;
  const aisleOf = (genre: string) => film.aisles?.find((a) => a.name === genre);
  const tags: { label: string; href?: string }[] = [
    { label: film.year ? String(film.year) : "", href: getDecades().includes(decade) ? `/decades/${decadeSlug(decade)}` : undefined },
    { label: d?.runtime ? `${d.runtime} min` : "" },
    ...(d?.genres ?? []).map((g) => ({ label: g, href: aisleOf(g) && `/aisles/${aisleOf(g)!.slug}` })),
    { label: d?.language ?? "" },
    { label: d?.colour ?? "" },
  ].filter((t) => t.label);
  const firstAisle = film.aisles?.[0];
  const person = (name: string, slug?: string) =>
    slug ? (
      <Link key={slug} href={`/people/${slug}`} className={styles.personLink}>
        {name}
      </Link>
    ) : (
      name
    );

  const cover = (
    <Cover
      title={film.title}
      year={film.year}
      directorName={film.directorName}
      poster={film.poster}
      sizes="(max-width: 767px) 230px, 300px"
      eager
    />
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className={`page ${styles.crumbs}`}>
        <Link className="lbl" href="/">
          Home
        </Link>
        <span className="lbl" aria-hidden="true">
          /
        </span>
        {aisle ? (
          <>
            <Link className="lbl" href={`/#aisle-${aisle.slug}`}>
              Aisle {aisle.num} {aisle.name}
            </Link>
            <span className="lbl" aria-hidden="true">
              /
            </span>
          </>
        ) : (
          firstAisle && (
            <>
              <Link className="lbl" href="/aisles">
                Aisles
              </Link>
              <span className="lbl" aria-hidden="true">
                /
              </span>
              <Link className="lbl" href={`/aisles/${firstAisle.slug}`}>
                {firstAisle.name}
              </Link>
              <span className="lbl" aria-hidden="true">
                /
              </span>
            </>
          )
        )}
        <span className={`lbl ${styles.here}`} aria-current="page">
          {film.title}
        </span>
      </nav>

      <section className={`page ${styles.hero}`}>
        <div className={styles.boxCol}>
          {d ? (
            <FlipBox
              className={styles.box}
              label={`VHS box of ${film.title}`}
              front={cover}
              back={<BoxBack film={film} details={d} />}
            />
          ) : (
            <div className={`${styles.box} ${styles.boxShadow}`}>{cover}</div>
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
              <li key={t.label} className="lbl">
                {t.href ? (
                  <Link href={t.href} className={styles.tagLink}>
                    {t.label}
                  </Link>
                ) : (
                  t.label
                )}
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
                    <dd>{person(film.directorName, film.directorSlug)}</dd>
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
                      {d.cast.slice(0, 3).map((c, i) => (
                        <span key={`${c.name}-${i}`}>
                          {i > 0 && ", "}
                          {person(c.name, c.slug)}
                        </span>
                      ))}
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
              {film.boxSet && (
                <p className={styles.boxSet}>
                  <span className="lbl">Part of a box set</span>
                  <SlideLink
                    href={`/box-sets/${film.boxSet.slug}`}
                    text={film.boxSet.name}
                    hoverText={`Open the ${film.boxSet.name} box →`}
                  />
                </p>
              )}
              <div className={styles.actions}>
                {d.trailerUrl && (
                  <ParticleLink className="lbl btn btn-solid" href={d.trailerUrl} target="_blank" rel="noreferrer">
                    ▶ Watch trailer
                  </ParticleLink>
                )}
                <ParticleLink className={`lbl btn ${d.trailerUrl ? "" : "btn-solid"}`} href="#back">
                  Cast &amp; credits ↓
                </ParticleLink>
              </div>
            </>
          ) : (
            <>
              {film.directorName && (
                <dl className={styles.facts}>
                  <dt className="lbl">Director</dt>
                  <dd>{person(film.directorName, film.directorSlug)}</dd>
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
