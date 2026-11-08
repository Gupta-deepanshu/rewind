import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crumbs } from "@/components/browse/PageHead";
import { Cover } from "@/components/vhs/Cover";
import { Slipcase } from "@/components/vhs/Slipcase";
import { getBoxSetPage, getPrebuiltBoxSets } from "@/lib/catalog";
import styles from "./box-set.module.css";

export async function generateStaticParams() {
  const slugs = await getPrebuiltBoxSets();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/box-sets/[slug]">): Promise<Metadata> {
  const set = await getBoxSetPage((await params).slug);
  return set
    ? { title: `${set.name} box set`, description: set.overview || `${set.films.length} tapes in one box.` }
    : { title: "Box set not found" };
}

export default function BoxSetPage({ params }: PageProps<"/box-sets/[slug]">) {
  return (
    <Suspense fallback={<div className="page lbl" style={{ paddingTop: 48 }}>Fetching the box from the back room…</div>}>
      <BoxSet params={params} />
    </Suspense>
  );
}

async function BoxSet({ params }: Pick<PageProps<"/box-sets/[slug]">, "params">) {
  const set = await getBoxSetPage((await params).slug);
  if (!set) notFound();
  const years = set.films.map((f) => f.year);

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Home" }, { href: "/box-sets", label: "Box sets" }, { label: set.name }]} />

      <section className={`page ${styles.hero}`}>
        <div className={styles.caseCol}>
          <div className={styles.case}>
            <Slipcase name={set.name} films={set.films} />
          </div>
        </div>
        <div className={styles.info}>
          <span className={`lbl ${styles.kicker}`}>
            Box set · {set.films.length} tapes · {years[0]}–{years[years.length - 1]}
          </span>
          <h1 className={styles.title}>{set.name}</h1>
          {set.overview && <p className={styles.overview}>{set.overview}</p>}
        </div>
      </section>

      <section className={`page ${styles.tapes}`} aria-labelledby="tapes-title">
        <div className={styles.head}>
          <span className={`lbl ${styles.kicker}`}>In this box</span>
          <h2 id="tapes-title" className={styles.h2}>
            Every tape, in order
          </h2>
        </div>
        <ol className={styles.grid}>
          {set.films.map((f, i) => (
            <li key={f.slug}>
              <Link href={`/films/${f.slug}`} className={styles.tape}>
                <div className={styles.cover}>
                  <Cover title={f.title} year={f.year} poster={f.poster} sizes="190px" />
                </div>
                <span className={`lbl ${styles.part}`}>Tape {i + 1}</span>
                <span className={styles.name}>{f.title}</span>
                <span className={`lbl ${styles.year}`}>{f.year}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
