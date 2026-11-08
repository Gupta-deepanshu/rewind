import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./SlideLink.module.css";

/**
 * A link whose label slides up on hover while a second label rises from below. Adapted from
 * KokonutUI's Slide Text Button (MIT, @kokonut-labs, https://kokonutui.com/docs/buttons/slide-text-button)
 * for this site's CSS modules: both labels share one grid cell, so the wider one sets the width.
 */
export function SlideLink({
  text,
  hoverText,
  className = "",
  solid = false,
  ...props
}: Omit<ComponentProps<typeof Link>, "children"> & {
  text: string;
  /** What it says on hover. Defaults to `text`. */
  hoverText?: string;
  /** Filled cobalt, like `.btn-solid`. */
  solid?: boolean;
}) {
  return (
    <Link className={`lbl ${styles.link} ${solid ? styles.solid : ""} ${className}`} {...props}>
      <span className={styles.slide}>
        <span className={styles.label}>{text}</span>
        <span className={`${styles.label} ${styles.next}`} aria-hidden="true">
          {hoverText ?? text}
        </span>
      </span>
    </Link>
  );
}
