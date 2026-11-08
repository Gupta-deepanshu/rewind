"use client";

import SplitFlapText from "../reactbits/SplitFlapText";

/**
 * Lettering on a mechanical split-flap board that flips into place once, in the store's dark
 * panel colours (so it follows the theme). Uses React Bits' Split Flap Text.
 */
export function FlapBoard({ text, size = "big" }: { text: string; size?: "big" | "small" }) {
  const big = size === "big";
  return (
    <SplitFlapText
      text={text}
      loop={false}
      padTo={0}
      charset="alphanumeric"
      tileColor={big ? "var(--panel)" : "var(--panel-ledge)"}
      textColor="var(--on-panel)"
      tileRadius={big ? 6 : 3}
      gap={big ? 6 : 3}
      fontSize={big ? "clamp(52px, 9vw, 112px)" : 20}
      flipDuration={big ? 0.09 : 0.07}
      stagger={big ? 0.08 : 0.03}
      flipsPerChar={big ? 10 : 6}
      depth={big ? 0.6 : 0.35}
    />
  );
}
