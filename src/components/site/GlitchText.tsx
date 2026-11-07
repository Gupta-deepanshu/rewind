"use client";

/**
 * Text that breaks up like a VHS tracking error: hard-cut horizontal bands jump sideways and a
 * thin red/cyan channel split peeks out. Adapted from KokonutUI's Glitch Text (MIT,
 * @dorianbaffier, https://kokonutui.com/docs/texts/glitch-text) for this site's CSS modules.
 *
 * - `hover`: a burst on pointer enter (or tap).
 * - `idle`: a rare burst every 4-9 s while on screen and the tab is visible.
 * Nothing glitches with reduced motion.
 */

import { type CSSProperties, type PointerEvent, useCallback, useEffect, useRef } from "react";
import styles from "./GlitchText.module.css";

type Trigger = "idle" | "hover";
type Intensity = "subtle" | "medium" | "strong";

/** bands: horizontal cuts; shift: max sideways jump (em); split: max channel offset (px). */
const INTENSITY: Record<Intensity, { bands: number; shift: number; split: number; frames: number; frame: number }> = {
  subtle: { bands: 3, shift: 0.05, split: 1, frames: 5, frame: 55 },
  medium: { bands: 4, shift: 0.12, split: 2, frames: 6, frame: 55 },
  strong: { bands: 5, shift: 0.18, split: 3, frames: 7, frame: 50 },
};

const MAX_BANDS = 5;
const BAND_IDS = Array.from({ length: MAX_BANDS }, (_, i) => i);
// each keyframe holds until the next one: a glitch cuts, it doesn't glide
const HOLD = "steps(1, end)";
const FIRST_IDLE = 1200;
const IDLE_MIN = 4000;
const IDLE_SPREAD = 5000;
// chance a band stays put on a frame, so it reads as broken signal rather than a shake
const STILL_CHANCE = 0.3;

const round = (n: number) => Math.round(n * 1000) / 1000;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Keyframes that hold each value for one frame, then end on the last one. */
const held = (frames: Keyframe[]): Keyframe[] => [
  ...frames.map((k, i) => ({ ...k, offset: i / frames.length, easing: HOLD })),
  { ...frames.at(-1), offset: 1 },
];

/** Random band boundaries from 0 to 100%, no band much thinner than another. */
function randomCuts(count: number) {
  const weights = Array.from({ length: count }, () => 0.55 + Math.random());
  const total = weights.reduce((a, b) => a + b, 0);
  const cuts = [0];
  for (const w of weights) cuts.push(round((cuts.at(-1) ?? 0) + (w / total) * 100));
  return cuts;
}

function jump(max: number) {
  if (Math.random() < STILL_CHANCE) return 0;
  return round((Math.random() < 0.5 ? -1 : 1) * (0.25 + 0.75 * Math.random()) * max);
}

/** Sideways positions of one band: off on frame one (if it must move), home on the last. */
function bandPath(frames: number, shift: number, forceMove: boolean) {
  return Array.from({ length: frames }, (_, f) => {
    if (f === frames - 1) return 0;
    const x = jump(shift);
    return f === 0 && forceMove && x === 0 ? round(shift * 0.6) : x;
  });
}

export function GlitchText({
  text,
  trigger = "hover",
  intensity = "medium",
  accent = "var(--vermilion)",
  className = "",
}: {
  text: string;
  trigger?: Trigger;
  intensity?: Intensity;
  /** Colour of the leading channel. The other one is cyan. */
  accent?: string;
  className?: string;
}) {
  const layersRef = useRef<HTMLSpanElement>(null);
  const animsRef = useRef<Animation[]>([]);
  const runningRef = useRef(false);

  const stop = useCallback(() => {
    for (const a of animsRef.current) a.cancel();
    animsRef.current = [];
    runningRef.current = false;
  }, []);

  const burst = useCallback(() => {
    const root = layersRef.current;
    if (!root) return;
    stop();
    const s = INTENSITY[intensity];
    const opts: KeyframeAnimationOptions = { duration: s.frames * s.frame, fill: "none" };
    const anims: Animation[] = [];
    const run = (el: Element, frames: Keyframe[]) => anims.push(el.animate(held(frames), opts));

    const base = root.querySelector('[data-layer="base"]');
    if (base) run(base, [{ opacity: 0 }]);

    // the bands tile the text top to bottom, so at rest they rebuild it; the outer edges
    // reach past the box to keep ascenders and descenders
    const cuts = randomCuts(s.bands);
    const mover = Math.floor(Math.random() * s.bands);
    root.querySelectorAll<HTMLElement>('[data-layer="band"]').forEach((band, i) => {
      if (i >= s.bands) return;
      const top = i === 0 ? -50 : cuts[i];
      const bottom = i === s.bands - 1 ? -50 : round(100 - cuts[i + 1]);
      band.style.clipPath = `inset(${top}% -25% ${bottom}% -25%)`;
      run(
        band,
        bandPath(s.frames, s.shift, i === mover).map((x) => ({ opacity: 1, transform: `translate3d(${x}em, 0, 0)` })),
      );
    });

    // red and cyan copies sit behind the bands and peek out on either side
    const offsets = Array.from({ length: s.frames }, () => Math.max(1, Math.ceil(Math.random() * s.split)));
    root.querySelectorAll('[data-layer="channel"]').forEach((channel, c) => {
      const dir = c === 0 ? -1 : 1;
      run(
        channel,
        offsets.map((d, f) => ({ opacity: f === s.frames - 1 ? 0 : 1, transform: `translate3d(${dir * d}px, 0, 0)` })),
      );
    });

    animsRef.current = anims;
    runningRef.current = true;
    const last = anims.at(-1);
    if (last) {
      last.onfinish = () => {
        animsRef.current = [];
        runningRef.current = false;
      };
    }
  }, [intensity, stop]);

  // idle: a rare burst, only while on screen and the tab is visible
  useEffect(() => {
    const root = layersRef.current;
    if (trigger !== "idle" || !root) return;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!(document.hidden || runningRef.current || reducedMotion())) burst();
        schedule(IDLE_MIN + Math.random() * IDLE_SPREAD);
      }, delay);
    };
    const update = () => {
      if (visible && !document.hidden) {
        if (timer === undefined) schedule(FIRST_IDLE);
      } else {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      update();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      clearTimeout(timer);
    };
  }, [trigger, burst]);

  useEffect(() => stop, [stop]);

  const onPointer = (e: PointerEvent) => {
    // mouse bursts on enter; touch and pen burst on press, since they can't hover
    const isMouse = e.pointerType === "mouse";
    if (trigger !== "hover" || (e.type === "pointerenter") !== isMouse || runningRef.current || reducedMotion()) return;
    burst();
  };

  return (
    <span
      className={`${styles.root} ${className}`}
      onPointerDown={onPointer}
      onPointerEnter={onPointer}
      style={{ "--glitch-accent": accent } as CSSProperties}
    >
      <span className="sr-only">{text}</span>
      <span ref={layersRef} aria-hidden="true" className={styles.layers}>
        <span className={`${styles.layer} ${styles.ghost} ${styles.red}`} data-layer="channel">
          {text}
        </span>
        <span className={`${styles.layer} ${styles.ghost} ${styles.cyan}`} data-layer="channel">
          {text}
        </span>
        <span className={styles.layer} data-layer="base">
          {text}
        </span>
        {BAND_IDS.map((id) => (
          <span key={id} className={`${styles.layer} ${styles.ghost}`} data-layer="band">
            {text}
          </span>
        ))}
      </span>
    </span>
  );
}
