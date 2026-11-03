import { AisleNav, AisleShelf } from "@/components/home/AisleShelf";
import { DirectorShelf } from "@/components/home/DirectorShelf";
import { StaffPick } from "@/components/home/StaffPick";
import { getAisles, getDirectorShelves, getStaffPicks } from "@/lib/catalog";

export default async function Home() {
  const [picks, aisles, directors] = await Promise.all([getStaffPicks(), getAisles(), getDirectorShelves()]);
  return (
    <>
      <StaffPick picks={picks} />
      <AisleNav aisles={aisles} />
      {aisles.map((aisle) => (
        <AisleShelf key={aisle.slug} aisle={aisle} />
      ))}
      <DirectorShelf directors={directors} />
    </>
  );
}
