import type { Metadata } from "next";
import { PageHead } from "@/components/browse/PageHead";
import { Shelf } from "@/components/browse/Shelf";
import { SignNav } from "@/components/browse/SignNav";
import { getAisleIndex, getAisleSigns } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "The aisles",
  description: "Every aisle in the store, from Drama to Westerns, with the best-loved tapes on each.",
};

export default async function AislesPage() {
  const [signs, shelves] = [getAisleSigns(), await getAisleIndex()];
  return (
    <>
      <PageHead
        kicker="Browse the store"
        title="The aisles"
        lede="Every genre has its own aisle. These are the best-loved tapes on each one. Walk an aisle to see all of it, sorted and filtered your way."
      />
      <SignNav label="Aisles" signs={signs.map((a) => ({ href: `/aisles/${a.slug}`, num: a.num, name: a.name }))} />
      {shelves.map((s) => (
        <Shelf
          key={s.slug}
          id={`aisle-${s.slug}`}
          kicker={s.kicker}
          title={s.title}
          films={s.films}
          count="Best loved"
          href={s.href}
          linkText="Walk the aisle"
        />
      ))}
    </>
  );
}
