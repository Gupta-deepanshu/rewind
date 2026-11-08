"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ParticleButton } from "./ParticleButton";
import styles from "./SurpriseButton.module.css";

/** Pulls a random well-rated tape off the shelf and opens it. */
export function SurpriseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const surprise = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/surprise", { cache: "no-store" });
      const { slug } = (await res.json()) as { slug: string };
      router.push(`/films/${slug}`);
    } catch {
      // offline: nothing to open
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParticleButton
      type="button"
      className={`lbl ${styles.button}`}
      onClick={surprise}
      aria-busy={busy}
      title="Open a random well-rated film"
    >
      <svg aria-hidden="true" className={`${styles.die} ${busy ? styles.rolling : ""}`} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="2" y="2" width="12" height="12" rx="2" />
        <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span className={styles.text}>{busy ? "Shuffling…" : "Surprise me"}</span>
    </ParticleButton>
  );
}
