import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Filters, Pager } from "@/components/browse/Filters";
import { Crumbs, PageHead } from "@/components/browse/PageHead";
import { SpineRow } from "@/components/vhs/SpineRow";
import { AISLE_SORTS, getAislePage, getAisleSigns, getDecades, shelvesOf } from "@/lib/catalog";
import type { AisleSort } from "@/lib/types";
import styles from "./aisle.module.css";

export function generateStaticParams() {
  return getAisleSigns().map((a) => ({ genre: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/aisles/[genre]">): Promise<Metadata> {
  const { genre } = await params;
  const sign = getAisleSigns().find((a) => a.slug === genre);
  return sign
    ? { title: `${sign.name} aisle`, description: `Every ${sign.name.toLowerCase()} film on the Rewind shelves.` }
    : { title: "Aisle not found" };
}

export default function AislePage(props: PageProps<"/aisles/[genre]">) {
  // the shelf depends on the query string (sort, decade, page), so it renders per request
  return (
    <Suspense fallback={<AisleLoading />}>
      <Aisle {...props} />
    </Suspense>
  );
}

function AisleLoading() {
  return (
    <div className="page" aria-busy="true" style={{ paddingTop: 48 }}>
      <span className="lbl">Walking down the aisle…</span>
    </div>
  );
}

type Query = { sort: AisleSort; decade?: number; page: number };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function readQuery(sp: Record<string, string | string[] | undefined>): Query {
  const sort = AISLE_SORTS.find((s) => s.id === one(sp.sort))?.id ?? "top";
  const decade = Number(one(sp.decade));
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));
  return { sort, decade: getDecades().includes(decade) ? decade : undefined, page };
}

function hrefFor(genre: string, q: Partial<Query>) {
  const sp = new URLSearchParams();
  if (q.sort && q.sort !== "top") sp.set("sort", q.sort);
  if (q.decade) sp.set("decade", String(q.decade));
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  const s = sp.toString();
  return `/aisles/${genre}${s ? `?${s}` : ""}`;
}

async function Aisle({ params, searchParams }: PageProps<"/aisles/[genre]">) {
  const [{ genre }, sp] = await Promise.all([params, searchParams]);
  const q = readQuery(sp);
  const data = await getAislePage(genre, q);
  if (!data) notFound();

  const page = Math.min(q.page, data.totalPages);
  const rows = shelvesOf(data.films);
  const sortLabel = AISLE_SORTS.find((s) => s.id === q.sort)!.label.toLowerCase();
  const decadeLabel = q.decade ? `from the ${q.decade}s` : "";

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Home" }, { href: "/aisles", label: "Aisles" }, { label: data.aisle.name }]} />
      <PageHead
        kicker={`Aisle ${data.aisle.num}`}
        title={data.aisle.name}
        meta={[`${data.films.length} tapes on this shelf`, data.totalPages > 1 ? `shelf ${page} of ${data.totalPages}` : ""]
          .filter(Boolean)
          .join(" · ")}
      />
      <Filters
        groups={[
          {
            label: "Sort",
            options: AISLE_SORTS.map((s) => ({ label: s.label, href: hrefFor(genre, { ...q, sort: s.id, page: 1 }), current: s.id === q.sort })),
          },
          {
            label: "Decade",
            options: [
              { label: "All", href: hrefFor(genre, { ...q, decade: undefined, page: 1 }), current: !q.decade },
              ...getDecades().map((d) => ({
                label: `${d}s`,
                href: hrefFor(genre, { ...q, decade: d, page: 1 }),
                current: d === q.decade,
              })),
            ],
          },
        ]}
      />

      <section className={`page ${styles.wall}`} aria-label={`${data.aisle.name}, ${sortLabel} ${decadeLabel}`.trim()}>
        {rows.length > 0 ? (
          rows.map((row, i) => <SpineRow key={i} films={row} label={`${data.aisle.name}, shelf ${i + 1}`} />)
        ) : (
          <p className={styles.empty}>No {data.aisle.name.toLowerCase()} tapes {decadeLabel || "here"} yet. Try another decade.</p>
        )}
      </section>

      <Pager page={page} total={data.totalPages} href={(p) => hrefFor(genre, { ...q, page: p })} />
    </>
  );
}
