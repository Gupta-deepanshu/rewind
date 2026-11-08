import type { AisleShelfData } from "@/lib/types";
import { Shelf } from "../browse/Shelf";
import { SignNav } from "../browse/SignNav";

export function AisleNav({ aisles }: { aisles: AisleShelfData[] }) {
  return (
    <SignNav
      id="aisles"
      label="Aisles"
      signs={aisles.map((a) => ({ href: `#aisle-${a.slug}`, num: a.num, name: a.name }))}
    />
  );
}

export function AisleShelf({ aisle }: { aisle: AisleShelfData }) {
  return (
    <Shelf
      id={`aisle-${aisle.slug}`}
      kicker={`Aisle ${aisle.num}`}
      title={aisle.name}
      films={aisle.films}
      href={aisle.href}
      linkText="Walk the aisle"
    />
  );
}
