"use client";

/**
 * The VHS box on a film page, which you can turn over: drag it, flick it, click it, or press
 * Enter / Space. Adapted from KokonutUI's Flick Card (MIT, @dorianbaffier,
 * https://kokonutui.com/docs/cards/card-flip) for this site's CSS modules: the same damped
 * spring, flick projection, hover tilt, sweeping light and card thickness, spinning on the
 * vertical axis only. With reduced motion it turns without spinning.
 */

import { type KeyboardEvent, type PointerEvent, type ReactNode, type Ref, useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./FlipBox.module.css";

// degrees of turn per px of drag
const DEG_PER_PX = 0.6;
// spring that lands the box on a face, in degrees and seconds
const STIFFNESS = 170;
const DAMPING = 20;
// how far ahead (in seconds of release velocity) the landing face is picked
const PROJECTION = 0.22;
// a release faster than this (deg/s) always turns at least one face
const FLICK_SPEED = 450;
const MAX_HALF_TURNS = 6;
// movement below this (px) is a click, not a drag
const DRAG_SLOP = 4;
// how far the box lifts toward the viewer at 90°, in px
const LIFT = 36;
// hover pre-tilt toward the pointer, in degrees
const TILT = 6;
// box thickness: stacked slices between the two faces (a VHS case is deep, so more than a card)
const THICKNESS = 10;
const SLICES = 9;
const SLICE_DEPTHS = Array.from({ length: SLICES }, (_, i) => -THICKNESS / 2 + (THICKNESS * (i + 0.5)) / SLICES);
const SUBSTEP = 1 / 240;
const VELOCITY_WINDOW = 80;

const INTERACTIVE = "button, a, input, select, textarea, [data-no-flip]";

const mod2 = (n: number) => ((n % 2) + 2) % 2;
const sideOf = (angle: number) => mod2(Math.round(angle / 180)) === 1;
const nearestFace = (angle: number) => Math.round(angle / 180) * 180;

type Sim = {
  angle: number;
  velocity: number;
  target: number;
  raf: number;
  last: number;
  reduceMotion: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  startAngle: number;
  dragging: boolean;
  samples: { t: number; a: number }[];
};

const cardTransform = (angle: number, lift: number) => `translateZ(${lift.toFixed(2)}px) rotateY(${angle.toFixed(2)}deg)`;

function releaseVelocity(samples: Sim["samples"], now: number) {
  const last = samples.at(-1);
  if (!last || now - last.t > VELOCITY_WINDOW) return 0;
  const first = samples.find((p) => last.t - p.t <= VELOCITY_WINDOW);
  if (!first || last.t <= first.t) return 0;
  return ((last.a - first.a) / (last.t - first.t)) * 1000;
}

export function FlipBox({
  front,
  back,
  label,
  className = "",
}: {
  front: ReactNode;
  back: ReactNode;
  /** Accessible name, e.g. "VHS box of Paris, Texas". */
  label: string;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  // which face is turned toward the viewer right now (changes at 90°)
  const [backVisible, setBackVisible] = useState(false);
  const hintId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frontBandRef = useRef<HTMLDivElement>(null);
  const backBandRef = useRef<HTMLDivElement>(null);
  const frontShadeRef = useRef<HTMLDivElement>(null);
  const backShadeRef = useRef<HTMLDivElement>(null);
  const backVisibleRef = useRef(false);

  const sim = useRef<Sim>({
    angle: 0,
    velocity: 0,
    target: 0,
    raf: 0,
    last: 0,
    reduceMotion: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startAngle: 0,
    dragging: false,
    samples: [],
  });

  const render = useCallback(() => {
    const s = sim.current;
    const rad = (s.angle * Math.PI) / 180;
    const sin = Math.sin(rad);
    const turn = Math.abs(sin);
    const facing = Math.abs(Math.cos(rad));

    if (cardRef.current) cardRef.current.style.transform = cardTransform(s.angle, turn * LIFT);
    if (shadowRef.current) {
      // the floor shadow narrows and fades as the box turns edge-on
      shadowRef.current.style.transform = `scale(${(0.16 + 0.84 * facing).toFixed(3)}, ${(1 - turn * 0.12).toFixed(3)})`;
      shadowRef.current.style.opacity = (1 - turn * 0.45).toFixed(3);
    }
    // a band of light sweeps across whichever face is showing, and the face dims as it turns away
    const shift = `translateX(${(sin * 140).toFixed(1)}%) rotate(18deg)`;
    for (const band of [frontBandRef.current, backBandRef.current]) {
      if (band) {
        band.style.opacity = (turn * 0.12).toFixed(3);
        band.style.transform = shift;
      }
    }
    for (const shade of [frontShadeRef.current, backShadeRef.current]) {
      if (shade) shade.style.opacity = (turn * 0.14).toFixed(3);
    }

    const showsBack = sideOf(s.angle);
    if (showsBack !== backVisibleRef.current) {
      backVisibleRef.current = showsBack;
      setBackVisible(showsBack);
    }
  }, []);

  const stepRef = useRef<(now: number) => void>(() => {});
  const step = useCallback(
    (now: number) => {
      const s = sim.current;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      const n = Math.max(1, Math.ceil(dt / SUBSTEP));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const force = -STIFFNESS * (s.angle - s.target) - DAMPING * s.velocity;
        s.velocity += force * h;
        s.angle += s.velocity * h;
      }
      if (Math.abs(s.angle - s.target) < 0.05 && Math.abs(s.velocity) < 0.5) {
        // settled: park on 0 or 180 so the numbers never grow, then sleep
        s.target = sideOf(s.target) ? 180 : 0;
        s.angle = s.target;
        s.velocity = 0;
        s.raf = 0;
        render();
        return;
      }
      render();
      s.raf = requestAnimationFrame((t) => stepRef.current(t));
    },
    [render],
  );
  // the loop schedules itself through a ref, so it always runs the current `step`
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const settle = useCallback(() => {
    const s = sim.current;
    if (s.reduceMotion) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.target = sideOf(s.target) ? 180 : 0;
      s.angle = s.target;
      s.velocity = 0;
      render();
      return;
    }
    if (!s.raf) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(step);
    }
  }, [render, step]);

  const aim = useCallback(
    (target: number) => {
      sim.current.target = target;
      setFlipped(sideOf(target));
      settle();
    },
    [settle],
  );

  const flipBy = useCallback((direction: number) => aim(nearestFace(sim.current.target) + 180 * direction), [aim]);

  useEffect(() => {
    const s = sim.current;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduceMotion = query.matches;
    const onChange = () => {
      s.reduceMotion = query.matches;
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  const setTilt = (x: number, y: number) => {
    if (tiltRef.current) tiltRef.current.style.transform = `rotateX(${(-y * TILT).toFixed(2)}deg) rotateY(${(x * TILT).toFixed(2)}deg)`;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    // one pointer at a time: a second finger does not steal the drag
    if (s.pointerId !== null || e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) return;
    s.pointerId = e.pointerId;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.startAngle = s.angle;
    s.dragging = false;
    s.samples = [{ t: e.timeStamp, a: s.angle }];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.pointerId !== e.pointerId) {
      // the hover tilt follows the cursor; it's movement, so reduced motion skips it
      if (e.pointerType !== "mouse" || s.reduceMotion || !rootRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      setTilt(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      return;
    }
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.dragging) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      s.dragging = true;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.velocity = 0;
      setTilt(0, 0);
    }
    // one to one: the box stays under the finger
    s.angle = s.startAngle + dx * DEG_PER_PX;
    s.samples.push({ t: e.timeStamp, a: s.angle });
    if (s.samples.length > 8) s.samples.shift();
    render();
  };

  const release = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = sim.current;
    if (s.pointerId !== e.pointerId) return;
    s.pointerId = null;
    if (!s.dragging) {
      if (!cancelled) {
        // a click pushes the half you pressed away from you
        const r = e.currentTarget.getBoundingClientRect();
        flipBy(e.clientX > r.left + r.width / 2 ? 1 : -1);
      }
      return;
    }
    s.dragging = false;
    const velocity = cancelled ? 0 : releaseVelocity(s.samples, e.timeStamp);
    const from = nearestFace(s.startAngle);
    let target = nearestFace(s.angle + velocity * PROJECTION);
    if (Math.abs(velocity) > FLICK_SPEED && target === from) target = from + 180 * Math.sign(velocity);
    const limit = MAX_HALF_TURNS * 180;
    s.velocity = velocity;
    aim(Math.max(from - limit, Math.min(from + limit, target)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flipBy(1);
    }
  };

  return (
    <div className={`${styles.wrap} ${className}`}>
      <div
        ref={rootRef}
        role="group"
        aria-roledescription="flip card"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        className={styles.root}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => release(e, false)}
        onPointerCancel={(e) => release(e, true)}
        onLostPointerCapture={(e) => release(e, true)}
        onPointerLeave={() => {
          if (sim.current.pointerId === null) setTilt(0, 0);
        }}
      >
        <div ref={shadowRef} aria-hidden="true" className={styles.shadow} />
        <div ref={tiltRef} className={styles.tilt}>
          <div ref={cardRef} className={styles.card} style={{ transform: cardTransform(0, 0) }}>
            {/* the case's edge: thin slices stacked between the two faces */}
            {SLICE_DEPTHS.map((z) => (
              <div key={z} aria-hidden="true" className={styles.slice} style={{ transform: `translateZ(${z.toFixed(3)}px)` }} />
            ))}
            <div
              className={styles.face}
              aria-hidden={backVisible || undefined}
              inert={backVisible}
              style={{ transform: `translateZ(${THICKNESS / 2}px)` }}
            >
              {front}
              <LightBand bandRef={frontBandRef} shadeRef={frontShadeRef} />
            </div>
            <div
              className={styles.face}
              aria-hidden={!backVisible || undefined}
              inert={!backVisible}
              style={{ transform: `rotateY(180deg) translateZ(${THICKNESS / 2}px)` }}
            >
              {back}
              <LightBand bandRef={backBandRef} shadeRef={backShadeRef} />
            </div>
          </div>
        </div>
        <span id={hintId} className="sr-only">
          Showing the {flipped ? "back" : "front"}. Press Enter or Space, or drag, to turn it over.
        </span>
      </div>
      <button type="button" className={`lbl ${styles.turn}`} onClick={() => flipBy(1)}>
        ↻ Turn the box over
      </button>
    </div>
  );
}

function LightBand({ bandRef, shadeRef }: { bandRef: Ref<HTMLDivElement>; shadeRef: Ref<HTMLDivElement> }) {
  return (
    <div aria-hidden="true" className={styles.light}>
      <div ref={shadeRef} className={styles.shade} />
      <div ref={bandRef} className={styles.band} />
    </div>
  );
}
