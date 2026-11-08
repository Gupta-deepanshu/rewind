import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/browse/PageHead";
import { Slipcase } from "@/components/vhs/Slipcase";
import { dataSource, getBoxSets } from "@/lib/catalog";
import styles from "./box-sets.module.css";

export const metadata: Metadata = {
  title: "Box sets",
  description: "Trilogies and series, boxed together: The Godfather, Back to the Future, the Apu Trilogy and more.",
};

export default async function BoxSetsPage() {
  const sets = await getBoxSets();
  return (
    <>
      <PageHead
        kicker="Box sets"
        title="Boxed together"
        lede="Trilogies and series in one slipcase, every tape in order. Pull a box off the shelf to see what’s inside."
      />
      {sets.length > 0 ? (
        <ul className={`page ${styles.wall}`} aria-label="Box sets">
          {sets.map((s) => (
            <li key={s.slug} className={styles.bay}>
              <Link href={`/box-sets/${s.slug}`} className={styles.set} aria-label={`${s.name}, ${s.films.length} tapes`}>
                <Slipcase name={s.name} films={s.films} />
              </Link>
              <div className="ledge" />
            </li>
          ))}
        </ul>
      ) : (
        <p className={`page ${styles.empty}`}>
          {dataSource() === "example"
            ? "The box sets come from TMDB. Connect the TMDB API (see .env.example) to stock this shelf."
            : "The box sets are being restocked. Try again in a minute."}
        </p>
      )}
    </>
  );
}
