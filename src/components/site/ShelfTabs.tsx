"use client";

/**
 * Tabs whose indicator slides between labels on a spring. Adapted from KokonutUI's Smooth Tab
 * (MIT, @dorianbaffier, https://kokonutui.com/docs/components/smooth-tab) for this site's CSS
 * modules, without the motion library: the same idea of painting the active labels a second
 * time, clipped to the indicator, so each label is exactly right at every point of the slide;
 * the same spring; arrow keys, Home and End.
 *
 * Its swipe-between-panels gesture is left out on purpose: the panels hold shelves that
 * scroll sideways, and the two would fight. Panels that haven't been opened yet aren't
 * rendered, so anything animated inside one starts when it is first shown.
 */

import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import styles from "./ShelfTabs.module.css";

export type ShelfTab = { id: string; title: string; count?: number; content: ReactNode };

// Just under critical damping, as in Smooth Tab: a firm settle with no wobble.
const STIFFNESS = 420;
const DAMPING = 38;
const SUBSTEP = 1 / 240;

type Rect = { left: number; width: number; top: number; height: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The indicator at a fractional tab position. */
function indicatorAt(rects: Rect[], p: number): Rect | null {
  const last = rects.length - 1;
  if (last < 0) return null;
  const q = Math.min(Math.max(p, 0), last);
  const i = Math.min(Math.floor(q), Math.max(last - 1, 0));
  const a = rects[i];
  const b = rects[Math.min(i + 1, last)];
  const t = q - i;
  return { left: lerp(a.left, b.left, t), width: lerp(a.width, b.width, t), top: a.top, height: a.height };
}

export function ShelfTabs({
  tabs,
  label,
  onChange,
}: {
  tabs: ShelfTab[];
  label: string;
  /** Called with the tab's id when a different tab is chosen. */
  onChange?: (id: string) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [opened, setOpened] = useState<Set<number>>(() => new Set([0]));
  const baseId = useId();

  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rects = useRef<Rect[]>([]);
  const size = useRef({ width: 0, height: 0 });
  const sim = useRef({ pos: 0, vel: 0, target: 0, raf: 0, last: 0, reduced: false });
  // the spring loop schedules itself through a ref, so it always runs the current `frame`
  const frameRef = useRef<(now: number) => void>(() => {});

  const paint = useCallback(() => {
    const overlay = overlayRef.current;
    const r = indicatorAt(rects.current, sim.current.pos);
    if (!overlay || !r) return;
    const right = size.current.width - r.left - r.width;
    const bottom = size.current.height - r.top - r.height;
    overlay.style.clipPath = `inset(${r.top}px ${right}px ${bottom}px ${r.left}px)`;
  }, []);

  const frame = useCallback(
    (now: number) => {
      const s = sim.current;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      const n = Math.max(1, Math.ceil(dt / SUBSTEP));
      for (let i = 0; i < n; i++) {
        const force = -STIFFNESS * (s.pos - s.target) - DAMPING * s.vel;
        s.vel += force * (dt / n);
        s.pos += s.vel * (dt / n);
      }
      if (Math.abs(s.pos - s.target) < 0.001 && Math.abs(s.vel) < 0.01) {
        s.pos = s.target;
        s.vel = 0;
        s.raf = 0;
        paint();
        return;
      }
      paint();
      s.raf = requestAnimationFrame((t) => frameRef.current(t));
    },
    [paint],
  );
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  const moveTo = useCallback(
    (index: number, instant = false) => {
      const s = sim.current;
      s.target = index;
      if (instant || s.reduced) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        s.pos = index;
        s.vel = 0;
        paint();
        return;
      }
      if (!s.raf) {
        s.last = performance.now();
        s.raf = requestAnimationFrame(frame);
      }
    },
    [frame, paint],
  );

  // measure the tabs before paint, and again on resize and once the fonts load
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const box = list.getBoundingClientRect();
      size.current = { width: box.width, height: box.height };
      rects.current = tabRefs.current.slice(0, tabs.length).map((tab) => {
        const r = tab?.getBoundingClientRect();
        return r ? { left: r.left - box.left, width: r.width, top: r.top - box.top, height: r.height } : { left: 0, width: 0, top: 0, height: 0 };
      });
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    document.fonts.ready.then(measure).catch(() => undefined);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [tabs.length, paint]);

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      s.reduced = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  const select = (index: number, instant = false) => {
    if (index !== selected) onChange?.(tabs[index].id);
    setSelected(index);
    setOpened((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
    moveTo(index, instant);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    const keys: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    // a held key repeats faster than the spring settles: jump instead
    select(next, e.repeat);
  };

  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = (i: number) => `${baseId}-panel-${i}`;
  const labelOf = (t: ShelfTab) => (
    <>
      <span>{t.title}</span>
      {t.count !== undefined && <span className={styles.count}>{t.count}</span>}
    </>
  );

  return (
    <div className={styles.root}>
      <div ref={listRef} role="tablist" aria-label={label} className={`lbl ${styles.list}`}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={tabId(i)}
            type="button"
            role="tab"
            aria-selected={i === selected}
            aria-controls={panelId(i)}
            tabIndex={i === selected ? 0 : -1}
            className={styles.tab}
            onClick={() => select(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {labelOf(t)}
          </button>
        ))}
        {/* the same labels again in the active colours, clipped to the indicator */}
        <div ref={overlayRef} aria-hidden="true" className={styles.overlay} style={{ clipPath: "inset(0 100% 0 0)" }}>
          {tabs.map((t) => (
            <span key={t.id} className={styles.tab}>
              {labelOf(t)}
            </span>
          ))}
        </div>
      </div>

      {tabs.map((t, i) => (
        <div
          key={t.id}
          id={panelId(i)}
          role="tabpanel"
          aria-labelledby={tabId(i)}
          hidden={i !== selected}
          className={styles.panel}
        >
          {opened.has(i) && t.content}
        </div>
      ))}
    </div>
  );
}
