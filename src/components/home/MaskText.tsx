"use client";

import { useLayoutEffect, useRef, useState, type ElementType } from "react";
import styles from "./MaskText.module.css";

const EASE = "cubic-bezier(.2,.8,.2,1)";

/**
 * Text that slides through a mask when it changes: the new line comes in from one side
 * while the old one leaves through the other. `dir` is +1 (from below) or -1 (from above).
 *
 * The first text is rendered by React (so it is in the server HTML); later texts are
 * swapped in imperatively so several can be in flight at once when flipping quickly.
 */
export function MaskText({
  text,
  dir,
  as: Tag = "div",
  className = "",
}: {
  text: string;
  dir: number;
  as?: ElementType;
  className?: string;
}) {
  const box = useRef<HTMLElement>(null);
  const [initial] = useState(text);
  const shown = useRef(text);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || text === shown.current) return;
    shown.current = text;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = document.createElement("span");
    next.textContent = text;
    const old = Array.from(el.children) as HTMLElement[];
    el.appendChild(next);

    const leave = (node: HTMLElement) => {
      // The first line belongs to React, so it is hidden instead of removed.
      if (node.dataset.initial) node.style.display = "none";
      else node.remove();
    };

    if (reduce) {
      old.forEach(leave);
      return;
    }
    next.animate([{ transform: `translateY(${dir * 105}%)` }, { transform: "translateY(0)" }], {
      duration: 650,
      easing: EASE,
      fill: "both",
    });
    for (const node of old) {
      if (node.dataset.leaving || node.style.display === "none") continue;
      node.dataset.leaving = "1";
      const from = getComputedStyle(node).transform;
      node.getAnimations().forEach((a) => a.cancel());
      const a = node.animate(
        [{ transform: from === "none" ? "translateY(0)" : from }, { transform: `translateY(${-dir * 105}%)` }],
        { duration: 650, easing: EASE, fill: "both" },
      );
      a.onfinish = () => leave(node);
    }
  }, [text, dir]);

  return (
    <Tag ref={box} className={`${styles.mask} ${className}`}>
      <span data-initial="1">{initial}</span>
    </Tag>
  );
}
