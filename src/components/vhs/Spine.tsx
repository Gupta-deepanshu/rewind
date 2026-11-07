import type { ReactNode } from "react";
import { spineLook, spineTitleSize, type SpineLayout, type SpineLook } from "@/lib/vhs";
import styles from "./Spine.module.css";

/** How much of the standard title size each layout's typeface can take. */
const TITLE_SCALE: Record<SpineLayout, number> = {
  classic: 1,
  band: 0.95,
  split: 0.74,
  stack: 1,
  outline: 1.02,
  edge: 0.8,
};

const DOT_COLOURS = ["#f2c94c", "#7cc47f", "#ef7aa1", "#7fb2ff"];

/**
 * A code-generated VHS spine, sized in em: the parent sets font-size. A standard case is
 * 5em × 29.6em (the real VHS spine ratio; 10px → 50 × 296 px); slim and wide cases differ a
 * little. The layout, colours, case and sticker come from the title and year (see spineLook).
 * `fixedSize` keeps the standard case, for the 3D shelf whose geometry assumes it.
 */
export function Spine({ title, year, fixedSize = false }: { title: string; year: number; fixedSize?: boolean }) {
  const look = spineLook(title, year, { fixedSize });
  const size = spineTitleSize(title) * TITLE_SCALE[look.layout] * Math.min(1, look.width / 5);

  return (
    <div
      className={`${styles.spine} ${styles[look.scheme]} ${styles[look.layout]} ${look.faded ? styles.faded : ""}`}
      style={{ width: `${look.width}em`, height: `${look.height}em` }}
    >
      <Layout look={look} title={title} year={year} size={size} sticker={look.sticker && <Sticker look={look} title={title} />} />
    </div>
  );
}

function Title({ title, size, className = "" }: { title: string; size: number; className?: string }) {
  return (
    <div className={`${styles.title} ${className}`} style={{ fontSize: `${size}em` }}>
      <span>{title}</span>
    </div>
  );
}

const Vhs = () => <span className={styles.vhs}>VHS</span>;

/** `sticker` goes just above the foot, in the flow, so it never covers the title. */
function Layout({
  look,
  title,
  year,
  size,
  sticker,
}: {
  look: SpineLook;
  title: string;
  year: number;
  size: number;
  sticker: ReactNode;
}) {
  switch (look.layout) {
    // a shape at the top, the title down the middle, the label at the foot
    case "classic":
      return (
        <>
          <div className={`${styles.mark} ${styles[look.mark]}`} />
          <Title title={title} size={size} />
          {sticker}
          <div className={styles.foot}>
            <span className={styles.brand}>{look.distributor}</span>
            <Vhs />
          </div>
        </>
      );

    // a solid block across the top with the catalogue number, a serif italic title
    case "band":
      return (
        <>
          <div className={styles.band}>
            <span className={styles.catalogue}>{look.catalogue}</span>
          </div>
          <Title title={title} size={size} />
          {sticker}
          <div className={styles.foot}>
            <span className={styles.brand}>{look.distributor}</span>
          </div>
        </>
      );

    // two-tone case: a heavy title reading upward, the label in the lower block
    case "split":
      return (
        <>
          <Title title={title} size={size} />
          {sticker}
          <div className={styles.lower}>
            <span className={styles.brand}>{look.distributor}</span>
            <Vhs />
          </div>
        </>
      );

    // the title in short stacked lines across the spine, under a round logo
    case "stack":
      return (
        <>
          <span className={styles.logo}>{look.distributor[0]}</span>
          <div className={styles.stackTitle} style={{ fontSize: `${stackSize(title, look.width)}em` }}>
            {title.split(/\s+/).map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          {year > 0 && <span className={styles.year}>{year}</span>}
          {sticker}
          <div className={styles.foot}>
            <span className={styles.brand}>{look.distributor}</span>
            <Vhs />
          </div>
        </>
      );

    // stripes at the top and a big outlined title, very 80s
    case "outline":
      return (
        <>
          <div className={styles.topStripes} />
          <Title title={title} size={size} />
          {sticker}
          <div className={styles.foot}>
            <span className={styles.brand}>{look.distributor}</span>
            <Vhs />
          </div>
        </>
      );

    // coloured rules down both edges, the label in a lozenge, a clean bold title
    case "edge":
      return (
        <>
          <span className={styles.lozenge}>{look.distributor.split(" ")[0]}</span>
          <Title title={title} size={size} />
          {sticker}
          <div className={styles.foot}>
            {year > 0 && <span className={styles.year}>{year}</span>}
            <Vhs />
          </div>
        </>
      );
  }
}

/** Stacked words: as big as the longest word allows across the spine. */
function stackSize(title: string, width: number) {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  return Math.min(1.25, (width - 1) / (longest * 0.62));
}

/** A store sticker: a coloured dot, a shelf-number label or a barcode label. */
function Sticker({ look, title }: { look: SpineLook; title: string }) {
  if (look.sticker === "dot") {
    return <span aria-hidden="true" className={styles.dot} style={{ background: DOT_COLOURS[title.length % DOT_COLOURS.length] }} />;
  }
  if (look.sticker === "label") {
    return (
      <span aria-hidden="true" className={styles.label}>
        No. {String((title.length * 137) % 9000 + 1000)}
      </span>
    );
  }
  return <span aria-hidden="true" className={`${styles.label} ${styles.barcode}`} />;
}
