"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { askHref, MAX_QUERY_LENGTH } from "@/lib/ai-search/query";
import styles from "./ClerkCounter.module.css";

/**
 * The counter: where the customer tells the clerk what they want.
 *
 * It is a plain GET form to /search/ai, so it works before JavaScript loads. With JavaScript it
 * navigates inside a transition instead, which gives a pending state: the button is disabled
 * while the clerk works, and a second submit of the same words is ignored.
 */
export function ClerkCounter({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const hintId = `${id}-hint`;

  const trimmed = query.replace(/\s+/g, " ").trim();
  const left = MAX_QUERY_LENGTH - query.length;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // nothing to ask, already asking, or asking again for exactly what's on the shelf
    if (!trimmed || pending || trimmed === initialQuery.replace(/\s+/g, " ").trim()) return;
    startTransition(() => router.push(askHref(trimmed)));
  }

  return (
    <form action="/search/ai" method="get" role="search" className={`page ${styles.counter}`} onSubmit={onSubmit} aria-busy={pending}>
      <div className={styles.desk}>
        <label htmlFor={`${id}-q`} className={`lbl ${styles.label}`}>
          What are you in the mood for?
        </label>
        <div className={styles.row}>
          <input
            id={`${id}-q`}
            name="q"
            type="search"
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="e.g. 90s heist movies under two hours"
            autoComplete="off"
            enterKeyHint="search"
            aria-describedby={hintId}
            required
          />
          <button type="submit" className={`lbl btn btn-solid ${styles.ask}`} disabled={pending || !trimmed}>
            {pending ? "Searching…" : "Ask the clerk"}
          </button>
        </div>
        <p id={hintId} className={`lbl ${styles.hint}`}>
          {pending ? (
            <span className={styles.searching}>The clerk is searching the shelves…</span>
          ) : (
            <span>Plain English is fine: a mood, a decade, a director, a running time.</span>
          )}
          {/* only worth showing near the limit */}
          {left <= 40 && <span className={left <= 10 ? styles.near : undefined}>{left} left</span>}
        </p>
      </div>
      <div className="ledge" aria-hidden="true" />
    </form>
  );
}
