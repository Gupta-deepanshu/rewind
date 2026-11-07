"use client";

/**
 * The site's search: a command palette in the header, adapted from KokonutUI's Command Palette
 * (MIT, https://kokonutui.com/docs/navigation/action-search-bar) for this site's CSS modules.
 *
 * - Films come live from /api/search (TMDB when connected, otherwise the example data).
 * - "Jump to" sections of the homepage and a theme switch are matched locally with fuzzy search.
 * - Films opened from here are remembered (in this browser) and shown under "Recent".
 * - ⌘K / Ctrl+K opens it from anywhere on the page, and so does "/" when not typing elsewhere.
 */

import { usePathname, useRouter } from "next/navigation";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { scrollToId } from "@/lib/scroll";
import type { SearchItem } from "@/lib/types";
import { readTheme, switchTheme } from "./ThemeSwitch";
import styles from "./SearchPalette.module.css";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const RECENT_KEY = "rewind-recent";
const RECENT_LIMIT = 4;

/* The homepage's sections. The aisle slugs match the ones in lib/sources (tmdb.ts and local.ts). */
const JUMPS = [
  { id: "todays-picks", label: "Today’s picks", keywords: ["home", "pick", "featured"] },
  { id: "aisle-new-arrivals", label: "Aisle 01 New Arrivals", keywords: ["new", "recent", "latest"] },
  { id: "aisle-drama", label: "Aisle 02 Drama", keywords: ["drama"] },
  { id: "aisle-thriller-mystery", label: "Aisle 03 Thriller & Mystery", keywords: ["thriller", "mystery", "crime"] },
  { id: "directors", label: "Director’s shelf", keywords: ["director", "filmmaker"] },
];

/* ------------------------------------------------------------------ fuzzy matching */

const WORD_BREAK = /[\s\-_/.&]/;
const isWordStart = (t: string, i: number) => i === 0 || WORD_BREAK.test(t[i - 1] ?? "");

function nextWordStart(t: string, ch: string, from: number) {
  for (let j = from; j < t.length; j++) if (t[j] === ch && isWordStart(t, j)) return j;
  return from;
}

function subsequence(t: string, q: string, preferWordStarts: boolean) {
  const matches: number[] = [];
  let score = 0;
  let from = 0;
  for (const ch of q) {
    let i = t.indexOf(ch, from);
    if (i < 0) return null;
    const prev = matches.at(-1);
    // unless it continues a run, jump ahead to a word start holding `ch`
    if (preferWordStarts && (prev === undefined || i !== prev + 1)) i = nextWordStart(t, ch, i);
    score += prev !== undefined && i === prev + 1 ? 6 : 1;
    score += isWordStart(t, i) ? 8 : 0;
    score -= prev === undefined ? i * 0.5 : (i - prev - 1) * 0.2;
    matches.push(i);
    from = i + 1;
  }
  return { score, matches };
}

/** Matched character indices and a score favouring runs, word starts and early hits; null if no match. */
function fuzzyMatch(text: string, query: string) {
  const t = text.toLowerCase();
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return { score: 0, matches: [] as number[] };
  const at = t.indexOf(q);
  if (at >= 0) return { score: 100 - at + (isWordStart(t, at) ? 30 : 0), matches: Array.from(q, (_, k) => at + k) };
  return subsequence(t, q, true) ?? subsequence(t, q, false);
}

/** Label matches are bolded; keyword matches still find the row, ranked lower. */
function matchItem(label: string, keywords: string[], query: string) {
  const onLabel = fuzzyMatch(label, query);
  if (onLabel) return onLabel;
  let best: number | null = null;
  for (const word of keywords) {
    const hit = fuzzyMatch(word, query);
    if (hit && (best === null || hit.score > best)) best = hit.score;
  }
  return best === null ? null : { score: best / 2, matches: [] };
}

/* ------------------------------------------------------------------ rows */

type Kind = "film" | "recent" | "jump" | "theme";
/** One row; exactly one of film / section / theme says what choosing it does. */
type Row = {
  key: string;
  kind: Kind;
  label: string;
  meta?: string;
  matches: number[];
  film?: SearchItem;
  section?: string;
  theme?: "light" | "dark";
};
type Section = { key: string; label: string; rows: Row[]; note?: string };

function Highlighted({ text, matches }: { text: string; matches: number[] }) {
  if (matches.length === 0) return <>{text}</>;
  const hit = new Set(matches);
  const parts: { start: number; text: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const on = hit.has(i);
    const last = parts.at(-1);
    if (last && last.on === on) last.text += text[i];
    else parts.push({ start: i, text: text[i] ?? "", on });
  }
  return (
    <>
      {parts.map((p) =>
        p.on ? (
          <b key={p.start} className={styles.hit}>
            {p.text}
          </b>
        ) : (
          <span key={p.start}>{p.text}</span>
        ),
      )}
    </>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => <kbd className={styles.kbd}>{children}</kbd>;

function RowIcon({ kind }: { kind: Kind }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3 };
  switch (kind) {
    case "film": // a tape
      return (
        <svg {...common} aria-hidden="true">
          <rect x="1.5" y="3.5" width="13" height="9" rx="0.5" />
          <circle cx="5.5" cy="8" r="1.6" />
          <circle cx="10.5" cy="8" r="1.6" />
        </svg>
      );
    case "recent": // a clock
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.8V8l2.2 1.5" strokeLinecap="round" />
        </svg>
      );
    case "jump": // shelves
      return (
        <svg {...common} aria-hidden="true">
          <path d="M2 4.5h12M2 8h12M2 11.5h12" strokeLinecap="round" />
        </svg>
      );
    case "theme": // half moon
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="8" cy="8" r="5.6" />
          <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function readRecent(): SearchItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as SearchItem[]).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveRecent(film: SearchItem) {
  try {
    const { slug, title, year, directorName } = film;
    const next = [{ slug, title, year, directorName }, ...readRecent().filter((f) => f.slug !== slug)];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, RECENT_LIMIT)));
  } catch {}
}

const noSubscribe = () => () => {};

const filmMeta = (f: SearchItem) => [f.year || "", f.directorName].filter(Boolean).join(" / ");

/** Focus sits in an open modal dialog other than the palette. */
const inOtherModal = (focused: Element | null, root: HTMLElement) => {
  const modal = focused?.closest('[aria-modal="true"]');
  return Boolean(modal && !modal.contains(root));
};

const isTyping = (el: Element | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/* ------------------------------------------------------------------ palette */

export function SearchPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const uid = useId();
  const inputId = `${uid}-input`;
  const listboxId = `${uid}-listbox`;
  const optionId = (i: number) => `${uid}-option-${i}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchItem[]>([]);
  const [dark, setDark] = useState(false);
  // the server can't know the platform, so it renders the Mac key and the browser corrects it
  const isMac = useSyncExternalStore(
    noSubscribe,
    () => /mac|iphone|ipad/i.test(navigator.userAgent),
    () => true,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fadeNextOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

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
        setActive(0);
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

  /* -- open / close -- */

  const openPalette = (source: "keyboard" | "pointer") => {
    if (open) return;
    fadeNextOpen.current = source === "pointer";
    setRecent(readRecent());
    setDark(readTheme() === "dark");
    setActive(0);
    setOpen(true);
  };

  const closePalette = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (restoreFocus && target?.isConnected) target.focus();
    else inputRef.current?.blur();
  };

  // latest open/close for the window-level key listener
  const keyState = useRef({ open, openPalette, closePalette });
  useEffect(() => {
    keyState.current = { open, openPalette, closePalette };
  });

  // ⌘K / Ctrl+K anywhere, or "/" when not typing in a field
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const root = rootRef.current;
      if (!root || e.defaultPrevented) return;
      const combo = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(document.activeElement);
      if (!combo && !slash) return;
      const focused = document.activeElement;
      if (inOtherModal(focused, root)) return;
      e.preventDefault();
      const state = keyState.current;
      if (state.open) {
        if (combo) state.closePalette(true);
        return;
      }
      if (focused instanceof HTMLElement && !root.contains(focused)) returnFocus.current = focused;
      inputRef.current?.focus();
      inputRef.current?.select();
      state.openPalette("keyboard");
    };
    // capture, so nothing else on the page also takes the shortcut
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* -- rows -- */

  const sections = useMemo<Section[]>(() => {
    const nextTheme = dark ? "light" : "dark";
    const theme = {
      label: `Switch to ${nextTheme} theme`,
      keywords: ["theme", "dark", "light", "mode", "night", "day"],
    };

    const out: Section[] = [];
    if (q.length >= 2) {
      const films = results.map<Row>((f) => ({
        key: `film-${f.slug}`,
        kind: "film",
        label: f.title,
        meta: filmMeta(f),
        matches: fuzzyMatch(f.title, q)?.matches ?? [],
        film: f,
      }));
      out.push({
        key: "films",
        label: "Films",
        rows: films,
        note: films.length === 0 ? (loading ? "Checking the shelves…" : `No tapes on the shelf for “${q}”.`) : undefined,
      });
    } else if (recent.length > 0 && !q) {
      out.push({
        key: "recent",
        label: "Recent",
        rows: recent.map((f) => ({ key: `recent-${f.slug}`, kind: "recent", label: f.title, meta: filmMeta(f), matches: [], film: f })),
      });
    }

    const jumps: { row: Row; score: number }[] = [];
    for (const j of JUMPS) {
      const hit = matchItem(j.label, j.keywords, q);
      if (hit) jumps.push({ score: hit.score, row: { key: j.id, kind: "jump", label: j.label, matches: hit.matches, section: j.id } });
    }
    if (q) jumps.sort((a, b) => b.score - a.score);
    if (jumps.length) out.push({ key: "jump", label: "Jump to", rows: jumps.map((j) => j.row) });

    const themeHit = matchItem(theme.label, theme.keywords, q);
    if (themeHit) out.push({ key: "actions", label: "Actions", rows: [{ key: "theme", kind: "theme", label: theme.label, matches: themeHit.matches, theme: nextTheme }] });

    return out;
  }, [q, results, loading, recent, dark]);

  /** Does what a row says: open a film, glide to a homepage section, or switch theme. */
  const runRow = (row: Row) => {
    if (row.film) {
      saveRecent(row.film);
      closePalette(false);
      router.push(`/films/${row.film.slug}`);
    } else if (row.section) {
      closePalette(false);
      if (!(pathname === "/" && scrollToId(row.section))) router.push(`/#${row.section}`);
    } else if (row.theme) {
      const origin = inputRef.current;
      closePalette(false);
      if (origin) switchTheme(row.theme, origin);
    }
  };

  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const highlighted = Math.min(active, rows.length - 1);
  const activeRow = open ? rows[highlighted] : undefined;

  /* -- motion: fade in on a pointer open, and the panel's height follows its content -- */

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!(open && panel && fadeNextOpen.current)) return;
    fadeNextOpen.current = false;
    panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: EASE_OUT });
  }, [open]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!(open && body && content)) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let first = true;
    const fit = () => {
      const from = body.offsetHeight;
      const to = content.offsetHeight;
      body.style.height = `${to}px`;
      if (!first && !reduce && from !== to) {
        body.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 260, easing: EASE_OUT });
      }
      first = false;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(content);
    return () => ro.disconnect();
  }, [open]);

  // keep the highlighted row inside the list's scroll box (never the page)
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = document.getElementById(`${uid}-option-${highlighted}`);
    if (!(open && list && row)) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop + 6) list.scrollTop = top - 30;
    else if (bottom > list.scrollTop + list.clientHeight - 6) list.scrollTop = bottom - list.clientHeight + 6;
  }, [open, highlighted, sections, uid]);

  /* -- input -- */

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End": {
        e.preventDefault();
        if (!open) return openPalette("keyboard");
        if (rows.length === 0) return;
        if (e.key === "Home") setActive(0);
        else if (e.key === "End") setActive(rows.length - 1);
        else setActive((Math.max(highlighted, 0) + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
        return;
      }
      case "Enter":
        e.preventDefault();
        if (!open) openPalette("keyboard");
        else if (activeRow) runRow(activeRow);
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          closePalette(true);
        } else if (query) setQuery("");
        return;
    }
  };

  // close when focus leaves the whole palette (Tab away, click outside)
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (open && !(next instanceof Node && e.currentTarget.contains(next))) {
      returnFocus.current = null;
      closePalette(false);
    }
  };

  let rowIndex = -1;

  return (
    <div ref={rootRef} className={styles.root} onBlur={onBlur}>
      <div className={styles.panel} data-open={open || undefined}>
        <div className={styles.bar}>
          <svg aria-hidden="true" className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="4.6" />
            <path d="M10.4 10.4 14 14" strokeLinecap="round" />
          </svg>
          <label htmlFor={inputId} className="sr-only">
            Search films, or jump to a shelf
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            className={styles.input}
            placeholder="Search films"
            value={query}
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeRow ? optionId(highlighted) : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              openPalette("keyboard");
            }}
            onPointerDown={(e) => {
              if (e.button === 0) openPalette("pointer");
            }}
            onKeyDown={onKeyDown}
          />
          {!open && (
            <span aria-hidden="true" className={styles.hint}>
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          )}
        </div>

        {open && (
          // keep focus in the input while pressing inside, so its blur never closes the palette first
          <div ref={panelRef} onPointerDown={(e) => e.preventDefault()}>
            <div ref={bodyRef} className={styles.body}>
              <div ref={contentRef}>
                <div ref={listRef} id={listboxId} role="listbox" aria-label="Search results" aria-busy={loading} className={styles.list}>
                  {sections.map((section) => (
                    <div key={section.key} role="group" aria-labelledby={`${uid}-${section.key}`}>
                      <div id={`${uid}-${section.key}`} role="presentation" className={`lbl ${styles.group}`}>
                        {section.label}
                      </div>
                      {section.note && <p className={styles.note}>{section.note}</p>}
                      {section.rows.map((row) => {
                        rowIndex += 1;
                        const index = rowIndex;
                        return (
                          <div
                            key={row.key}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === highlighted}
                            className={styles.row}
                            onClick={() => runRow(row)}
                            onPointerMove={(e) => {
                              if (e.pointerType === "mouse" && index !== highlighted) setActive(index);
                            }}
                          >
                            <span className={styles.icon}>
                              <RowIcon kind={row.kind} />
                            </span>
                            <span className={styles.label}>
                              <Highlighted text={row.label} matches={row.matches} />
                            </span>
                            {row.meta && <span className={`lbl ${styles.meta}`}>{row.meta}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {rows.length === 0 && !sections.some((s) => s.note) && (
                    <p className={styles.note}>Nothing on the shelves matches “{q}”.</p>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.foot}>
              <span>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> Move
                <Kbd>↵</Kbd> Open
              </span>
              <span>
                <Kbd>esc</Kbd> Close
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
