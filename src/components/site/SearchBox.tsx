"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { SearchItem } from "@/lib/types";
import styles from "./SearchBox.module.css";

/** Search box with live results from /api/search (TMDB when connected, otherwise the example data). */
export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const listId = useId();
  const inputId = useId();

  const q = query.trim();

  // ask the server after a short pause in typing; ignore answers to older queries
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await res.json()) as { results: SearchItem[] };
        setResults(data.results);
        setCursor(0);
      } catch {
        // aborted or offline: keep what we had
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const shown = q.length >= 2 ? results : [];
  const show = open && q.length >= 2;

  function reset() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  return (
    <form
      role="search"
      className={styles.box}
      onSubmit={(e) => {
        e.preventDefault();
        const pick = shown[cursor] ?? shown[0];
        if (pick) {
          reset();
          router.push(`/films/${pick.slug}`);
        }
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search films
      </label>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder="Search films"
        className={styles.input}
        value={query}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button type="submit" className={`lbl ${styles.submit}`}>
        Search
      </button>
      {show && (
        <ul id={listId} role="listbox" className={styles.list} aria-busy={loading}>
          {shown.length === 0 && (
            <li className={styles.empty}>{loading ? "Checking the shelves…" : `No tapes on the shelf for “${q}”.`}</li>
          )}
          {shown.map((r, i) => (
            <li key={r.slug} role="option" aria-selected={i === cursor}>
              <Link
                href={`/films/${r.slug}`}
                className={styles.item}
                data-active={i === cursor || undefined}
                onMouseEnter={() => setCursor(i)}
                onClick={reset}
              >
                <span className={styles.title}>{r.title}</span>
                <span className="lbl">
                  {r.year || "—"}
                  {r.directorName ? ` / ${r.directorName}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
