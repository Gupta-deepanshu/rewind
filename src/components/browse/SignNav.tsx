import Link from "next/link";
import styles from "./SignNav.module.css";

export type Sign = { href: string; num?: string; name: string; current?: boolean };

/** A row of hanging aisle signs: numbered, ruled boxes that link somewhere. */
export function SignNav({ signs, label, id }: { signs: Sign[]; label: string; id?: string }) {
  return (
    <nav id={id} aria-label={label} className={`page ${styles.nav}`}>
      {signs.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={`lbl ${styles.sign} ${s.current ? styles.current : ""}`}
          aria-current={s.current ? "page" : undefined}
        >
          {s.num && <span className={styles.num}>{s.num}</span>}
          <span>{s.name}</span>
        </Link>
      ))}
    </nav>
  );
}
