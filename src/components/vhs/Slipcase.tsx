import type { FilmCard } from "@/lib/types";
import { vhsLook } from "@/lib/vhs";
import { Spine } from "./Spine";
import styles from "./Slipcase.module.css";

/**
 * A cardboard box-set slipcase, open along one side so the tapes inside show their spines.
 * Sized in em like the spines (the parent sets font-size). The colour comes from the set's name.
 */
export function Slipcase({ name, films }: { name: string; films: FilmCard[] }) {
  const { scheme } = vhsLook(name);
  const years = films.map((f) => f.year).filter(Boolean);
  const span = years.length ? (years[0] === years[years.length - 1] ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`) : "";

  return (
    <div className={`${styles.case} ${styles[scheme]}`}>
      <div className={styles.top}>
        <span>Rewind Video</span>
        <span>Box set</span>
      </div>
      <div className={styles.slot}>
        {films.map((f) => (
          <Spine key={f.slug} title={f.title} year={f.year} fixedSize />
        ))}
      </div>
      <div className={styles.label}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          {films.length}-tape collection{span && ` · ${span}`}
        </span>
      </div>
    </div>
  );
}
