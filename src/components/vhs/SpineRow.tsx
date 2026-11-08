import Link from "next/link";
import type { CreditCard } from "@/lib/types";
import { Spine } from "./Spine";
import styles from "./SpineRow.module.css";

/**
 * A row of spines standing on a shelf. Each spine links to its film; hovering pulls it out a little.
 * A film's `role` (on a person's page) goes in its tooltip and accessible name.
 */
export function SpineRow({
  films,
  label,
  size = "md",
  dark = false,
}: {
  films: CreditCard[];
  label: string;
  size?: "md" | "sm";
  dark?: boolean;
}) {
  return (
    <div className={`${styles.wrap} ${dark ? styles.dark : ""}`}>
      <ul className={`${styles.row} ${styles[size]}`} aria-label={label} data-lenis-prevent-horizontal>
        {films.map((f) => (
          <li key={f.slug}>
            <Link href={`/films/${f.slug}`} className={styles.tape} title={`${f.title} (${f.year})${f.role ? ` · ${f.role}` : ""}`}>
              <Spine title={f.title} year={f.year} />
              <span className="sr-only">
                {f.title}, {f.year}
                {f.role ? `, ${f.role}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={dark ? styles.darkLedge : "ledge"} />
    </div>
  );
}
