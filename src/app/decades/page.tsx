import type { Metadata } from "next";
import { PageHead } from "@/components/browse/PageHead";
import { Shelf } from "@/components/browse/Shelf";
import { SignNav } from "@/components/browse/SignNav";
import { getDecadeIndex } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Decades",
  description: "A century of film, one decade to a shelf: the best-loved tapes from the 1920s to now.",
};

export default async function DecadesPage() {
  const shelves = await getDecadeIndex();
  return (
    <>
      <PageHead
        kicker="Browse by era"
        title="Decades"
        lede="A century of film, one decade to a shelf. These are the best-loved tapes from each. Open a decade for its biggest hits and every genre it made."
      />
      <SignNav label="Decades" signs={shelves.map((s) => ({ href: s.href!, name: s.title.replace(/^The /, "") }))} />
      {shelves.map((s) => (
        <Shelf
          key={s.slug}
          id={`decade-${s.slug}`}
          kicker={s.kicker}
          title={s.title}
          films={s.films}
          count="Best loved"
          href={s.href}
          linkText={`Open the ${s.slug}`}
        />
      ))}
    </>
  );
}
