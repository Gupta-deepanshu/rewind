"use client";

/**
 * Light / dark switch, adapted from KokonutUI's Switch Button (MIT, @dorianbaffier,
 * https://kokonutui.com/docs/buttons/switch-button) for this site's CSS modules.
 *
 * The sun folds into a crescent moon (rays retract, a bite slides over the disc) and the new
 * theme spreads from the button as a circle (View Transitions API). With reduced motion, or in
 * a browser without view transitions, the theme switches instantly.
 *
 * The theme lives on <html data-theme>. The inline script in layout.tsx sets it before first
 * paint from the saved choice, or from the system setting when nothing is saved.
 */

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import styles from "./ThemeSwitch.module.css";

export type Theme = "light" | "dark";
export const THEME_KEY = "rewind-theme";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_REVEAL = "cubic-bezier(0.4, 0, 0.2, 1)";
const REVEAL_ATTR = "data-theme-reveal";

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const at = (r: number) => ({
    x: Number((12 + r * Math.cos(rad)).toFixed(2)),
    y: Number((12 + r * Math.sin(rad)).toFixed(2)),
  });
  return { deg, from: at(7.5), to: at(10) };
});

/*
 * Each part's light look is its base style and its dark look a [data-theme="dark"] rule, so the
 * server render matches the client. On click, each part animates from its old computed values
 * to the new ones with the Web Animations API.
 */
const ANIMATED_PROPS = ["opacity", "scale", "translate", "filter"] as const;
type Snapshot = Map<Element, Keyframe>;

function snapshot(elements: Element[]): Snapshot {
  const map: Snapshot = new Map();
  for (const el of elements) {
    const style = getComputedStyle(el);
    const frame: Keyframe = { offset: 0 };
    for (const prop of ANIMATED_PROPS) frame[prop] = style.getPropertyValue(prop);
    map.set(el, frame);
    for (const animation of el.getAnimations()) animation.cancel();
  }
  return map;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function timing(el: Element, toDark: boolean): KeyframeAnimationOptions {
  const { part, index = "0" } = (el as HTMLElement | SVGElement).dataset;
  const i = Number(index);
  switch (part) {
    case "ray":
      // rays retract one after another; on the way back they wait for the bite to clear
      return { delay: toDark ? i * 18 : 140 + i * 22, duration: 260, easing: EASE_OUT };
    case "bite":
      return { delay: toDark ? 60 : 0, duration: 380, easing: EASE_IN_OUT };
    case "disc":
      return { delay: toDark ? 40 : 0, duration: 380, easing: EASE_OUT };
    default:
      return { duration: 240, easing: EASE_OUT };
  }
}

function morph(from: Snapshot, toDark: boolean) {
  if (reducedMotion()) return;
  for (const [el, frame] of from) el.animate([frame, {}], { ...timing(el, toDark), fill: "backwards" });
}

let revealRunning = false;

/** Runs `apply` inside a view transition whose new view grows as a circle from the button. */
function revealFrom(button: HTMLElement, apply: () => void) {
  const doc = document as Document & { activeViewTransition?: unknown };
  if (typeof doc.startViewTransition !== "function" || reducedMotion() || revealRunning || doc.activeViewTransition) {
    apply();
    return;
  }

  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const root = document.documentElement;

  root.setAttribute(REVEAL_ATTR, "");
  revealRunning = true;

  let transition: ViewTransition;
  try {
    transition = doc.startViewTransition(() => flushSync(apply));
  } catch {
    root.removeAttribute(REVEAL_ATTR);
    revealRunning = false;
    apply();
    return;
  }

  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 500, easing: EASE_REVEAL, pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      // skipped or aborted, e.g. a page navigation started its own transition
    });

  transition.finished
    .catch(() => {
      // the theme is already applied by the time a transition can fail
    })
    .finally(() => {
      root.removeAttribute(REVEAL_ATTR);
      revealRunning = false;
    });
}

export const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Applies a theme the visitor chose and remembers it. */
function chooseTheme(theme: Theme) {
  setTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

/** Switches theme from somewhere other than the switch (the search palette), with the same reveal. */
export function switchTheme(next: Theme, origin: HTMLElement) {
  revealFrom(origin, () => chooseTheme(next));
}

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const maskId = `${useId()}-moon`;
  const iconRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  // only for aria-pressed: read after mount so the first client render matches the server
  const [current, setCurrent] = useState<Theme | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setCurrent(readTheme());
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    // until someone picks a theme, follow the system setting as it changes
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch {}
      if (saved !== "light" && saved !== "dark") setTheme(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", onSystem);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onSystem);
    };
  }, []);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    const apply = () => {
      const parts = [
        ...(iconRef.current?.querySelectorAll("[data-part]") ?? []),
        ...(labelRef.current?.querySelectorAll("[data-part]") ?? []),
      ];
      const before = snapshot(parts);
      chooseTheme(next);
      morph(before, next === "dark");
    };
    revealFrom(e.currentTarget, apply);
  };

  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={current ? current === "dark" : undefined}
      className={`lbl ${styles.switch} ${className}`}
      onClick={onClick}
    >
      <svg ref={iconRef} aria-hidden="true" className={styles.icon} fill="none" width="16" height="16" viewBox="0 0 24 24">
        <mask id={maskId}>
          <rect fill="white" x="-4" y="-4" width="32" height="32" />
          <circle className={styles.bite} data-part="bite" cx="17" cy="7" r="7.5" fill="black" />
        </mask>
        <g mask={`url(#${maskId})`}>
          <circle className={styles.disc} data-part="disc" cx="12" cy="12" r="4.75" fill="currentColor" />
        </g>
        <g stroke="currentColor" strokeLinecap="round" strokeWidth="2">
          {RAYS.map((ray, index) => (
            <line
              key={ray.deg}
              className={styles.ray}
              data-part="ray"
              data-index={index}
              x1={ray.from.x}
              y1={ray.from.y}
              x2={ray.to.x}
              y2={ray.to.y}
            />
          ))}
        </g>
      </svg>
      <span ref={labelRef} aria-hidden="true" className={styles.labels}>
        <span className={styles.lightLabel} data-part="label">
          Light
        </span>
        <span className={styles.darkLabel} data-part="label">
          Dark
        </span>
      </span>
    </button>
  );
}
