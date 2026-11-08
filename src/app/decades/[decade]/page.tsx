import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlapBoard } from "@/components/browse/FlapBoard";
import { Crumbs, PageHead } from "@/components/browse/PageHead";
import { Shelf } from "@/components/browse/Shelf";
import { SignNav } from "@/components/browse/SignNav";
import { decadeFromSlug, decadeSlug } from "@/lib/data/browse";
import { getDecadePage, getDecades } from "@/lib/catalog";

export function generateStaticParams() {
  return getDecades().map((d) => ({ decade: decadeSlug(d) }));
}

export async function generateMetadata({ params }: PageProps<"/decades/[decade]">): Promise<Metadata> {
  const decade = decadeFromSlug((await params).decade);
  return decade
    ? { title: `The ${decade}s`, description: `The best-loved films of the ${decade}s, shelf by shelf.` }
    : { title: "Decade not found" };
}

export default async function DecadePage({ params }: PageProps<"/decades/[decade]">) {
  const decade = decadeFromSlug((await params).decade);
  if (!decade) notFound();
  const { shelves } = await getDecadePage(decade);
  const decades = getDecades();

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Home" }, { href: "/decades", label: "Decades" }, { label: `${decade}s` }]} />
      <PageHead kicker="Decade" title={`The ${decade}s`} visual={<FlapBoard text={`${decade}s`} />} meta={`${decade} – ${decade + 9}`} />
      <SignNav
        label="Other decades"
        signs={decades.map((d) => ({ href: `/decades/${decadeSlug(d)}`, name: `${d}s`, current: d === decade }))}
      />
      {shelves.length === 0 && (
        <p className="page" style={{ fontFamily: "var(--serif)", fontSize: 18, paddingTop: 32, color: "var(--muted)" }}>
          Nothing from the {decade}s is on the shelf yet.
        </p>
      )}
      {shelves.map((s) => (
        <Shelf
          key={s.slug}
          id={`shelf-${s.slug}`}
          kicker={s.kicker}
          title={s.title}
          films={s.films}
          href={s.href}
          linkText={`${s.title} aisle`}
          hoverText={`All ${s.title.toLowerCase()} from the ${decade}s →`}
        />
      ))}
    </>
  );
}
