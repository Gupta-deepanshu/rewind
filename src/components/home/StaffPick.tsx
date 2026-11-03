"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PickCard } from "@/lib/types";
import { Cover } from "../vhs/Cover";
import { Spine } from "../vhs/Spine";
import { MaskText } from "./MaskText";
import styles from "./StaffPick.module.css";

/* The shelf repeats the picks three times so wrapping always happens off-screen. */
const COPIES = 3;
const LEAN = -4.5;
const PERSPECTIVE = 2200;
const SHEET_EASE = "cubic-bezier(.76,0,.18,1)";

const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Smooth step from -0.5 to 0.5 across |r| < 1: how far the open box pushes its neighbours. */
const push = (r: number) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);

type Tape = {
  el: HTMLDivElement;
  sp: HTMLDivElement;
  cv: HTMLDivElement;
  v: number;
  r: number;
  o: number;
  lift: number;
  visible: boolean;
};

type Controls = {
  step: (d: number) => void;
  random: () => void;
  open: () => void;
};

export function StaffPick({ picks }: { picks: PickCard[] }) {
  const N = picks.length;
  const L = N * COPIES;
  const router = useRouter();

  const shelfRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const tapeRefs = useRef<HTMLDivElement[]>([]);
  const controls = useRef<Controls | null>(null);
  // Where the shelf was. Next.js keeps this page alive (hidden) while you visit another page and
  // restarts the effect when you come back, so the shelf resumes here instead of starting over.
  const saved = useRef<number | null>(null);

  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const pick = picks[active];

  useEffect(() => {
    const shelf = shelfRef.current!;
    const stage = stageRef.current!;
    const probe = probeRef.current!;
    const sheet = sheetRef.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const HALF = L / 2;

    const tapes: Tape[] = tapeRefs.current.slice(0, L).map((el, v) => {
      // start clean: a previous run may have left tapes hidden (culled off-screen)
      el.style.visibility = "";
      return {
      el,
      sp: el.children[0] as HTMLDivElement,
      cv: el.children[1] as HTMLDivElement,
      v,
      r: 0,
      o: 0,
      lift: 0,
      visible: true,
      };
    });

    /* geometry, all derived from the tape height H */
    let H = 0;
    let ws = 0; // spine width
    let d = 0; // cover width = box depth
    let gap = 0;
    const measure = () => {
      H = probe.getBoundingClientRect().height;
      ws = (H * 142) / 840;
      d = (H * 474) / 900;
      gap = H * 0.03;
      stage.style.setProperty("--Hpx", `${H}px`);
      stage.style.setProperty("--ws", `${ws}px`);
      stage.style.setProperty("--d", `${d}px`);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(shelf);

    /* state: s = scroll position in tapes, T = target.
       First visit: start on the first pick and glide to a random one. Coming back: resume. */
    let s = saved.current ?? N;
    let T = saved.current ?? N + Math.floor(Math.random() * N);
    if (reduce) s = T;
    let shown = -1;
    let hover = -1;
    let mx = -1e4;
    let my = -1e4;
    let tiltX = 0;
    let tiltY = 0;
    let down = false;
    let dragging = false;
    let x0 = 0;
    let T0 = 0;
    let suppressClick = false;
    let opening = false;
    let wheelTimer = 0;

    const goTo = (i: number) => {
      const c = Math.round(T);
      let delta = mod(i - mod(c, N), N);
      if (delta > N / 2) delta -= N;
      T = c + delta;
    };

    const nearest = () => tapes.reduce((a, b) => (Math.abs(b.r) < Math.abs(a.r) ? b : a));

    const open = () => {
      if (opening) return;
      T = Math.round(T);
      const href = `/films/${picks[mod(Math.round(s), N)].slug}`;
      if (reduce) {
        router.push(href);
        return;
      }
      opening = true;
      /* a sheet of paper grows out of the cover, straightening as it fills the screen */
      const tape = nearest();
      const b = tape.cv.getBoundingClientRect();
      const z = 0.2 * H * tape.o + ws / 2;
      const k = PERSPECTIVE / (PERSPECTIVE - z);
      const w = d * k;
      const h = H * k;
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const vw = innerWidth;
      const vh = innerHeight;
      sheet.style.transformOrigin = `${cx}px ${cy}px`;
      sheet.style.visibility = "visible";
      const anim = sheet.animate(
        [
          {
            clipPath: `inset(${cy - h / 2}px ${vw - cx - w / 2}px ${vh - cy - h / 2}px ${cx - w / 2}px round 3px)`,
            transform: `rotate(${LEAN}deg)`,
          },
          { clipPath: "inset(0px 0px 0px 0px round 0px)", transform: "rotate(0deg)" },
        ],
        { duration: 850, easing: SHEET_EASE, fill: "both" },
      );
      anim.onfinish = () => router.push(href);
    };

    controls.current = {
      step: (delta) => {
        T = Math.round(T) + delta;
      },
      random: () => {
        let i = shown;
        while (N > 1 && i === shown) i = Math.floor(Math.random() * N);
        goTo(i);
      },
      open,
    };

    /* pointer input */
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!down) return;
      const dx = e.clientX - x0;
      if (!dragging && Math.abs(dx) > 5) dragging = true;
      if (dragging) T = T0 - dx / (ws + gap);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = true;
      dragging = false;
      x0 = e.clientX;
      T0 = T;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      if (dragging) {
        dragging = false;
        T = Math.round(T);
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 0);
      }
    };
    const onWheel = (e: WheelEvent) => {
      // only sideways scrolling moves the shelf, so the page still scrolls normally
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      T += (e.deltaX / (ws + gap)) * 0.5;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (T = Math.round(T)), 160);
    };
    shelf.addEventListener("pointerdown", onDown);
    shelf.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);

    const cleanups = tapes.map((t) => {
      const enter = () => (hover = t.v);
      const leave = () => {
        if (hover === t.v) hover = -1;
      };
      const click = () => {
        if (suppressClick || opening) return;
        if (Math.abs(t.r) < 0.5) open();
        else T = Math.round(T + t.r);
      };
      t.el.addEventListener("pointerenter", enter);
      t.el.addEventListener("pointerleave", leave);
      t.el.addEventListener("click", click);
      return () => {
        t.el.removeEventListener("pointerenter", enter);
        t.el.removeEventListener("pointerleave", leave);
        t.el.removeEventListener("click", click);
      };
    });

    /* the frame loop */
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const follow = reduce ? 1 : 1 - Math.exp(-(dragging ? 18 : 5.2) * dt);
      s += (T - s) * follow;
      if (Math.abs(T - s) < 1e-4) s = T;
      if (Math.abs(s) > L * 4) {
        const shift = Math.round(s / L) * L;
        s -= shift;
        T -= shift;
        T0 -= shift;
      }

      const current = mod(Math.round(s), N);
      if (current !== shown) {
        const way = Math.sign(T - s) || 1;
        shown = current;
        setDir(way);
        setActive(current);
      }

      const rect = shelf.getBoundingClientRect();
      const W = rect.width;
      const centerX = rect.left + W / 2;
      const centerY = rect.top + rect.height / 2;
      const settled = Math.abs(T - s) < 0.3;
      const onCover =
        !opening && settled && Math.abs(mx - centerX) < 0.55 * d && Math.abs(my - centerY) < 0.55 * H;
      shelf.dataset.oncover = onCover ? "1" : "";

      const tyTarget = onCover ? ((mx - centerX) / (0.55 * d)) * 9 : 0;
      const txTarget = onCover ? (-(my - centerY) / (H / 2)) * 6 : 0;
      const ease = 1 - Math.exp(-7 * dt);
      tiltY += (tyTarget - tiltY) * ease;
      tiltX += (txTarget - tiltX) * ease;

      const liftEase = reduce ? 1 : 1 - Math.exp(-12 * dt);
      const step = ws + gap;
      const spread = d - ws + 1.6 * gap;
      const limit = W / 2 + 1.5 * d;

      for (const t of tapes) {
        const r = mod(t.v - s + HALF, L) - HALF;
        t.r = r;
        const x = r * step + spread * push(r);
        const liftTarget = hover === t.v && Math.abs(r) > 0.5 && !opening ? 1 : 0;
        t.lift += (liftTarget - t.lift) * liftEase;

        if (Math.abs(x) > limit) {
          if (t.visible) {
            t.el.style.visibility = "hidden";
            t.visible = false;
          }
          t.o = 0;
          continue;
        }
        if (!t.visible) {
          t.el.style.visibility = "";
          t.visible = true;
        }
        const o = smooth(Math.max(0, 1 - Math.abs(r)));
        t.o = o;
        const y = -o * 0.025 * H - t.lift * 0.045 * H;
        const z = o * 0.2 * H;
        t.el.style.transform =
          `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) ` +
          `rotateZ(${(LEAN * o).toFixed(3)}deg) rotateX(${(tiltX * o).toFixed(3)}deg) ` +
          `rotateY(${(-90 * o + tiltY * o).toFixed(3)}deg)`;
        t.el.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
        t.sp.style.setProperty("--shade", (o * 0.55).toFixed(3));
        t.cv.style.setProperty("--shade", ((1 - o) * 0.5).toFixed(3));
        t.cv.style.setProperty("--shadow", (o * 0.55).toFixed(3));
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      saved.current = Math.round(T);
      cancelAnimationFrame(raf);
      clearTimeout(wheelTimer);
      resize.disconnect();
      shelf.removeEventListener("pointerdown", onDown);
      shelf.removeEventListener("wheel", onWheel);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      cleanups.forEach((c) => c());
      sheet.getAnimations().forEach((a) => a.cancel());
      sheet.style.visibility = "hidden";
      controls.current = null;
    };
  }, [N, L, picks, router]);

  const meta = [pick.year, pick.genres.join(", "), `${pick.runtime} min`, pick.originalTitle]
    .filter(Boolean)
    .join(" / ");

  return (
    <section id="todays-picks" className={`page ${styles.hero}`} aria-label="Today's picks">
      <div className={styles.info}>
        <div className={styles.head}>
          <span className={`lbl ${styles.kicker}`}>Today’s pick / 今日のおすすめ</span>
          <button type="button" className="lbl chip" onClick={() => controls.current?.random()}>
            ↻ Another pick
          </button>
        </div>
        <div aria-live="polite" className={styles.live}>
          <MaskText as="h1" className={styles.title} text={pick.title} dir={dir} />
          <MaskText className={`lbl ${styles.meta}`} text={meta} dir={dir} />
          <MaskText as="p" className={styles.synopsis} text={pick.synopsis} dir={dir} />
        </div>
        <dl className={styles.facts}>
          <dt className="lbl">Director</dt>
          <dd>
            <MaskText text={pick.directorName ?? "—"} dir={dir} />
          </dd>
          <dt className="lbl">Starring</dt>
          <dd>
            <MaskText text={pick.starring.join(", ")} dir={dir} />
          </dd>
        </dl>
        <figure className={styles.note}>
          {/* the film's tagline as the quote; if it has none, the reason takes its place */}
          <MaskText as="blockquote" className={styles.quote} text={pick.note ? `“${pick.note}”` : pick.reason} dir={dir} />
          <MaskText
            as="figcaption"
            className={`lbl ${styles.reason}`}
            text={`— ${pick.note ? pick.reason : "Today’s pick"}`}
            dir={dir}
          />
        </figure>
        <div className={styles.actions}>
          <Link className="lbl btn btn-solid" href={`/films/${pick.slug}`}>
            Full film details →
          </Link>
        </div>
      </div>

      <div className={styles.shelfCol}>
        <div className={styles.window}>
          <div
            ref={shelfRef}
            className={styles.shelf}
            tabIndex={0}
            role="group"
            aria-label="Today's picks shelf. Use the left and right arrow keys to browse and Enter to open the film."
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") controls.current?.step(-1);
              else if (e.key === "ArrowRight") controls.current?.step(1);
              else if (e.key === "Enter") controls.current?.open();
              else return;
              e.preventDefault();
            }}
          >
            <div ref={probeRef} className={styles.probe} aria-hidden="true" />
            <div ref={stageRef} className={styles.stage}>
              {Array.from({ length: L }, (_, v) => {
                const f = picks[v % N];
                return (
                  <div
                    key={v}
                    className={styles.tape}
                    aria-hidden="true"
                    ref={(el) => {
                      if (el) tapeRefs.current[v] = el;
                    }}
                  >
                    <div className={`${styles.face} ${styles.spine}`}>
                      <Spine title={f.title} />
                    </div>
                    <div className={`${styles.face} ${styles.cover}`}>
                      <Cover title={f.title} year={f.year} directorName={f.directorName} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`ledge ${styles.ledge}`} />
          </div>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.arrow} aria-label="Previous pick" onClick={() => controls.current?.step(-1)}>
            <svg viewBox="0 0 18 10" aria-hidden="true">
              <path d="M5 1 L1 5 L5 9 M1 5 H17" />
            </svg>
          </button>
          <span className={`lbl ${styles.count}`}>
            Drag, or click the box to open · {active + 1} / {N}
          </span>
          <button type="button" className={styles.arrow} aria-label="Next pick" onClick={() => controls.current?.step(1)}>
            <svg viewBox="0 0 18 10" aria-hidden="true">
              <path d="M13 1 L17 5 L13 9 M17 5 H1" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={sheetRef} className={styles.sheet} aria-hidden="true" />
    </section>
  );
}
