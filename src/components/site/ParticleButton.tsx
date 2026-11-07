"use client";

/**
 * Buttons and button-links that throw a burst of particles when pressed. The burst is adapted
 * from KokonutUI's Particle Button (MIT, @dorianbaffier,
 * https://kokonutui.com/docs/buttons/particle-button): small chips in the button's own colour
 * fly off its top edge, from where it was pressed, with gravity, drag and spin.
 *
 * The styling stays with the caller (e.g. "lbl btn btn-solid"). Nothing bursts with reduced motion.
 */

import Link from "next/link";
import { type ComponentProps, type MouseEvent, useEffect, useRef, useState } from "react";
import styles from "./ParticleButton.module.css";

const PARTICLE_COUNT = 18;
const GRAVITY = 0.0016; // px per ms²
const DRAG = 0.0022; // fraction of velocity lost per ms
const LIFETIME = 650;
const BLEED = 64; // room around the button the canvas can draw into
// a computed colour with zero alpha: rgba(0, 0, 0, 0) or oklch(… / 0)
const ZERO_ALPHA = /(,|\/)\s*0\)$/;

type Particle = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; w: number; h: number };
type BurstState = { id: number; originX: number; width: number; height: number; color: string };

function createParticles(originX: number, width: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // spread across the top edge, biased toward the press point
    const spread = (Math.random() - 0.5) * Math.min(width, 120);
    const x = Math.min(Math.max(originX + spread, 4), width - 4);
    const side = x < width / 2 ? -1 : 1;
    const speed = 0.18 + Math.random() * 0.22;
    const angle = -Math.PI / 2 + side * Math.random() * 0.9;
    const isChip = i % 3 === 0;
    return {
      x,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.02,
      w: isChip ? 5 : 3,
      h: isChip ? 2 : 3,
    };
  });
}

function Burst({ originX, width, height, color, onDone }: Omit<BurstState, "id"> & { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = width + BLEED * 2;
    const cssH = height + BLEED * 2;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.scale(dpr, dpr);

    const particles = createParticles(originX, width);
    const start = performance.now();
    let last = start;
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      const t = (now - start) / LIFETIME;
      ctx.clearRect(0, 0, cssW, cssH);
      if (t >= 1) {
        onDoneRef.current();
        return;
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = 1 - t * t;
      for (const p of particles) {
        p.vx *= 1 - DRAG * dt;
        p.vy = p.vy * (1 - DRAG * dt) + GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.translate(p.x + BLEED, p.y + BLEED);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [originX, width, height, color]);

  return (
    <span
      aria-hidden="true"
      className={styles.burst}
      style={{ top: -BLEED, left: -BLEED, width: width + BLEED * 2, height: height + BLEED * 2 }}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </span>
  );
}

/** Chips take the button's fill; outline buttons have none, so they burst in the text colour. */
function burstColor(el: HTMLElement) {
  const style = getComputedStyle(el);
  const fill = style.backgroundColor;
  return fill === "transparent" || ZERO_ALPHA.test(fill) ? style.color : fill;
}

function useBurst() {
  const [burst, setBurst] = useState<BurstState | null>(null);
  const fire = (e: MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    // keyboard clicks report 0,0, so they burst from the centre
    const originX = e.clientX === 0 && e.clientY === 0 ? rect.width / 2 : e.clientX - rect.left;
    setBurst({ id: performance.now(), originX, width: el.offsetWidth, height: el.offsetHeight, color: burstColor(el) });
  };
  const node = burst && (
    <Burst
      key={burst.id}
      originX={burst.originX}
      width={burst.width}
      height={burst.height}
      color={burst.color}
      onDone={() => setBurst(null)}
    />
  );
  return { fire, node };
}

export function ParticleButton({ className = "", onClick, children, ...props }: ComponentProps<"button">) {
  const { fire, node } = useBurst();
  return (
    <button
      type="button"
      {...props}
      className={`${styles.host} ${className}`}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) fire(e);
      }}
    >
      {node}
      {children}
    </button>
  );
}

/** A link styled as a button. Pages in the site go through next/link; #anchors and outside links stay plain. */
export function ParticleLink({ className = "", onClick, children, href, ...props }: ComponentProps<"a"> & { href: string }) {
  const { fire, node } = useBurst();
  const shared = {
    ...props,
    href,
    className: `${styles.host} ${className}`,
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) fire(e);
    },
  };
  const plain = href.startsWith("#") || /^[a-z]+:/i.test(href);
  return plain ? (
    <a {...shared}>
      {node}
      {children}
    </a>
  ) : (
    <Link {...shared}>
      {node}
      {children}
    </Link>
  );
}
