import Link from "next/link";
import type { ArrivalCard } from "@/lib/types";
import { Cover } from "../vhs/Cover";
import styles from "./ComingSoon.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-11-20" → sticker "20 Nov", full "Friday 20 November 2026" (from the date alone, so it renders the same everywhere) */
function dateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { sticker: `${d} ${MONTHS[m - 1]}`, full: `${weekday} ${d} ${MONTHS[m - 1]} ${y}` };
}

const GROUPS: { week: ArrivalCard["week"]; kicker: string; title: string }[] = [
  { week: "this", kicker: "Due in", title: "This week" },
  { week: "next", kicker: "Due in", title: "Next week" },
  { week: "later", kicker: "On order", title: "Later" },
];

/** Films that haven't opened yet: their covers grouped by week, each with an "Out" date sticker. */
export function ComingSoon({ films }: { films: ArrivalCard[] }) {
  if (films.length === 0) {
    return <p className={styles.empty}>Nothing announced yet. Check back next week.</p>;
  }
  return (
    <div className={styles.groups}>
      {GROUPS.map((g) => {
        const group = films.filter((f) => f.week === g.week);
        if (group.length === 0) return null;
        return (
          <section key={g.week} aria-labelledby={`soon-${g.week}`} className={styles.group}>
            <div className={styles.head}>
              <span className={`lbl ${styles.kicker}`}>{g.kicker}</span>
              <h2 id={`soon-${g.week}`} className={styles.title}>
                {g.title}
              </h2>
              <span className={`lbl ${styles.count}`}>
                {group.length} {group.length === 1 ? "tape" : "tapes"}
              </span>
            </div>
            <ol className={styles.grid}>
              {group.map((f) => {
                const d = dateParts(f.date);
                return (
                  <li key={f.slug}>
                    <Link href={`/films/${f.slug}`} className={styles.tape}>
                      <div className={styles.box}>
                        <div className={styles.cover}>
                          <Cover title={f.title} year={f.year} poster={f.poster} sizes="176px" />
                        </div>
                        <span className={`lbl ${styles.sticker}`} aria-hidden="true">
                          <span className={styles.out}>Out</span>
                          {d.sticker}
                        </span>
                      </div>
                      <span className={styles.name}>{f.title}</span>
                      <span className={`lbl ${styles.date}`}>Opens {d.full}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
