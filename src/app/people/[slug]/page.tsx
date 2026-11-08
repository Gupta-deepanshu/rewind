import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crumbs } from "@/components/browse/PageHead";
import { ShelfTabs } from "@/components/site/ShelfTabs";
import { SpineRow } from "@/components/vhs/SpineRow";
import { getPersonPage, getPrebuiltPeople, shelvesOf } from "@/lib/catalog";
import type { PersonPageData } from "@/lib/types";
import styles from "./person.module.css";

export async function generateStaticParams() {
  const slugs = await getPrebuiltPeople();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/people/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPersonPage(slug);
  if (!person) return { title: "Person not found" };
  return { title: person.name, description: person.bio?.slice(0, 160) || `${person.name}'s films on the Rewind shelf.` };
}

export default function PersonPage({ params }: PageProps<"/people/[slug]">) {
  return (
    <Suspense fallback={<PersonLoading />}>
      <Person params={params} />
    </Suspense>
  );
}

function PersonLoading() {
  return (
    <section className={`page ${styles.hero}`} aria-busy="true">
      <div className={styles.cardCol}>
        <div className={`${styles.card} ${styles.placeholder}`} />
      </div>
      <div className={styles.info}>
        <span className="lbl">Pulling their file from the back room…</span>
      </div>
    </section>
  );
}

const ROLE: Record<string, string> = { Directing: "Director", Acting: "Actor", Writing: "Writer", Production: "Producer" };

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function ageAt(born: string, until: string) {
  const [by, bm, bd] = born.split("-").map(Number);
  const [uy, um, ud] = until.split("-").map(Number);
  return uy - by - (um < bm || (um === bm && ud < bd) ? 1 : 0);
}

async function Person({ params }: Pick<PageProps<"/people/[slug]">, "params">) {
  const { slug } = await params;
  const person = await getPersonPage(slug);
  if (!person) notFound();

  const role = person.knownFor ? (ROLE[person.knownFor] ?? person.knownFor) : undefined;
  const tapes = new Set(person.shelves.flatMap((s) => s.films.map((f) => f.slug))).size;
  const paragraphs = (person.bio ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Home" }, { href: "/#directors", label: "People" }, { label: person.name }]} />

      <section className={`page ${styles.hero}`}>
        <div className={styles.cardCol}>
          <figure className={styles.card}>
            <div className={styles.photo}>
              {person.photo ? (
                <Image src={person.photo} alt={`${person.name}`} fill sizes="(max-width: 767px) 220px, 280px" loading="eager" />
              ) : (
                <span className={styles.initials} aria-hidden="true">
                  {initials(person.name)}
                </span>
              )}
            </div>
            <figcaption className={`lbl ${styles.caption}`}>
              <span>On file</span>
              <span>{role ?? "Film"}</span>
            </figcaption>
          </figure>
        </div>

        <div className={styles.info}>
          {role && <span className={`lbl ${styles.kicker}`}>{role}</span>}
          <h1 className={styles.name}>{person.name}</h1>
          <dl className={styles.facts}>
            {person.born && (
              <>
                <dt className="lbl">Born</dt>
                <dd>{longDate(person.born)}</dd>
              </>
            )}
            {person.died && (
              <>
                <dt className="lbl">Died</dt>
                <dd>
                  {longDate(person.died)}
                  {person.born && ` (aged ${ageAt(person.born, person.died)})`}
                </dd>
              </>
            )}
            {person.birthplace && (
              <>
                <dt className="lbl">From</dt>
                <dd>{person.birthplace}</dd>
              </>
            )}
            <dt className="lbl">On the shelf</dt>
            <dd>
              {tapes} {tapes === 1 ? "tape" : "tapes"}
            </dd>
          </dl>
          {paragraphs.length > 0 && <Bio paragraphs={paragraphs} />}
        </div>
      </section>

      <section className={`page ${styles.films}`} aria-labelledby="films-title">
        <div className={styles.filmsHead}>
          <span className={`lbl ${styles.kicker}`}>Filmography</span>
          <h2 id="films-title" className={styles.filmsTitle}>
            {person.name.split(" ")[0]}’s shelf
          </h2>
        </div>
        <Filmography person={person} />
      </section>
    </>
  );
}

function Bio({ paragraphs }: { paragraphs: string[] }) {
  const [lead, ...rest] = paragraphs;
  return (
    <div className={styles.bio}>
      <p>{lead}</p>
      {rest.length > 0 && (
        <details className={styles.more}>
          <summary className="lbl">Read the full biography</summary>
          {rest.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>
      )}
    </div>
  );
}

function Rows({ films, label }: { films: PersonPageData["shelves"][number]["films"]; label: string }) {
  const rows = shelvesOf(films);
  return (
    <div className={styles.rows}>
      {rows.map((row, i) => (
        <SpineRow key={i} films={row} label={rows.length > 1 ? `${label}, shelf ${i + 1}` : label} />
      ))}
    </div>
  );
}

function Filmography({ person }: { person: PersonPageData }) {
  if (person.shelves.length === 0) {
    return <p className={styles.empty}>Nothing of theirs is on the shelf yet.</p>;
  }
  if (person.shelves.length === 1) {
    const s = person.shelves[0];
    return <Rows films={s.films} label={`${s.title} by ${person.name}`} />;
  }
  return (
    <ShelfTabs
      label={`${person.name}'s films`}
      tabs={person.shelves.map((s) => ({
        id: s.id,
        title: s.title,
        count: s.films.length,
        content: <Rows films={s.films} label={`${s.title}: ${person.name}`} />,
      }))}
    />
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
