import Link from "next/link";
import { chipsFor } from "@/lib/ai-search/chips";
import type { ClerkAnswer as Answer } from "@/lib/ai-search/clerk";
import { EXAMPLE_QUERIES } from "@/lib/ai-search/examples";
import { askHref } from "@/lib/ai-search/query";
import { clerkHref } from "@/lib/ai-search/url";
import { SpineRow } from "../vhs/SpineRow";
import { Announce } from "./Announce";
import styles from "./ClerkAnswer.module.css";

/*
 * Every link to /search/ai has prefetch={false}: rendering that page can call the model, and a
 * prefetch (or a crawler following prefetched links) must never cost a model call.
 */

const tapes = (n: number) => `${n.toLocaleString("en")} ${n === 1 ? "tape" : "tapes"}`;

/** What screen readers hear once the answer is in. */
function announcement(a: Answer): string {
  if (a.mode === "off_topic" || a.mode === "refused") return a.comment;
  const count = a.total === 0 ? "No tapes found." : a.total > a.films.length ? `Showing ${a.films.length} of ${tapes(a.total)}.` : `${tapes(a.total)} found.`;
  return [a.notice, a.comment, count].filter(Boolean).join(" ");
}

/**
 * The clerk's answer. `rows` is the films stacked onto shelves (the page does that with the
 * catalog's shelvesOf, so this component doesn't depend on the data layer).
 */
export function ClerkAnswer({ answer, rows = [answer.films] }: { answer: Answer; rows?: Answer["films"][] }) {
  const chips = answer.filters ? chipsFor(answer.filters) : [];
  const searched = answer.mode !== "off_topic" && answer.mode !== "refused";

  return (
    <>
      <Announce message={announcement(answer)} />

      {chips.length > 0 && (
        <div className={`page ${styles.chips}`} role="group" aria-label="What the clerk searched for">
          <span className={`lbl ${styles.chipsLabel}`}>Searched for</span>
          <ul className={styles.chipList}>
            {chips.map((c) => (
              <li key={c.key}>
                <Link
                  href={clerkHref(answer.query, c.without)}
                  prefetch={false}
                  scroll={false}
                  className={`lbl ${styles.chip}`}
                  aria-label={`Remove ${c.kind}: ${c.label}`}
                >
                  {c.label}
                  <span aria-hidden="true" className={styles.x}>
                    ×
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className={`page ${styles.answer}`} aria-labelledby="clerk-says">
        <div className={styles.slip}>
          <h2 id="clerk-says" className={`lbl ${styles.kicker}`}>
            The clerk says
          </h2>
          <p className={styles.comment}>{answer.comment}</p>
          {answer.notice && <p className={styles.notice}>{answer.notice}</p>}
          {answer.dropped.length > 0 && (
            <p className={styles.notice}>
              Couldn&rsquo;t use {answer.dropped.join(", ")}, so {answer.dropped.length === 1 ? "that part was" : "those parts were"} left out.
            </p>
          )}
          {searched && answer.total > 0 && (
            <span className={`lbl ${styles.count}`}>
              {answer.total > answer.films.length ? `${answer.films.length} of ${tapes(answer.total)}` : tapes(answer.total)}
            </span>
          )}
        </div>
      </section>

      {answer.films.length > 0 && (
        <section className={`page ${styles.wall}`} aria-label="The clerk's picks">
          {rows.map((row, i) => (
            <SpineRow key={i} films={row} label={`The clerk's picks, shelf ${i + 1}`} />
          ))}
        </section>
      )}

      {/* a title search's own line already says it found nothing */}
      {searched && answer.mode !== "keyword" && answer.total === 0 && (
        <div className={`page ${styles.empty}`}>
          <p>Nothing on the shelves matches all of that.</p>
          {answer.suggestion && (
            <Link href={clerkHref(answer.query, answer.suggestion.filters)} prefetch={false} className={`lbl btn ${styles.loosen}`}>
              Try without {answer.suggestion.drop} →
            </Link>
          )}
        </div>
      )}

      {!searched && <ExampleQueries title="Try asking for" />}
    </>
  );
}

/** A few things to ask, for first-time visitors (and after an off-topic request). */
export function ExampleQueries({ title }: { title: string }) {
  return (
    <section className={`page ${styles.examples}`} aria-labelledby="clerk-examples">
      <h2 id="clerk-examples" className={`lbl ${styles.kicker}`}>
        {title}
      </h2>
      <ul className={styles.exampleList}>
        {EXAMPLE_QUERIES.map((q) => (
          <li key={q}>
            <Link href={askHref(q)} prefetch={false} className={styles.example}>
              &ldquo;{q}&rdquo;
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** While the clerk works: the Suspense fallback. */
export function ClerkSearching({ query }: { query: string }) {
  return (
    <section className={`page ${styles.answer}`} aria-busy="true">
      <Announce message="The clerk is searching the shelves…" />
      <div className={`${styles.slip} ${styles.busy}`}>
        <span className={`lbl ${styles.kicker}`}>The clerk is searching the shelves…</span>
        <p className={styles.comment}>&ldquo;{query}&rdquo;, coming right up.</p>
        <div className={styles.scan} aria-hidden="true" />
      </div>
    </section>
  );
}
