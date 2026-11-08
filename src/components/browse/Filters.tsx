import Link from "next/link";
import styles from "./Filters.module.css";

export type FilterOption = { label: string; href: string; current: boolean };

/** Labelled rows of filter chips. Each chip is a link, so filtering works without JavaScript. */
export function Filters({ groups }: { groups: { label: string; options: FilterOption[] }[] }) {
  return (
    <div className={`page ${styles.filters}`}>
      {groups.map((g) => (
        <div key={g.label} className={styles.group} role="group" aria-label={g.label}>
          <span className={`lbl ${styles.label}`}>{g.label}</span>
          <div className={styles.options}>
            {g.options.map((o) => (
              <Link
                key={o.label}
                href={o.href}
                scroll={false}
                className={`lbl ${styles.chip} ${o.current ? styles.current : ""}`}
                aria-current={o.current ? "true" : undefined}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** ← previous · Shelf 2 of 25 · next → */
export function Pager({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
  if (total <= 1) return null;
  return (
    <nav aria-label="Shelves" className={`page ${styles.pager}`}>
      {page > 1 ? (
        <Link className={`lbl btn btn-solid ${styles.step}`} href={href(page - 1)}>
          ← Previous shelf
        </Link>
      ) : (
        <span />
      )}
      <span className={`lbl ${styles.where}`}>
        Shelf {page} of {total}
      </span>
      {page < total ? (
        <Link className={`lbl btn btn-solid ${styles.step}`} href={href(page + 1)}>
          Next shelf →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
