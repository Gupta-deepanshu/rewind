import { spineTitleSize, vhsLook } from "@/lib/vhs";
import styles from "./Spine.module.css";

/**
 * A code-generated VHS spine. It is sized in em: the parent sets font-size,
 * and the spine is 5em × 29.6em (the real VHS spine ratio). 10px → 50 × 296 px.
 */
export function Spine({ title }: { title: string }) {
  const look = vhsLook(title);
  return (
    <div className={`${styles.spine} ${styles[look.scheme]}`}>
      <div className={`${styles.mark} ${styles[look.mark]}`} />
      <div className={styles.title} style={{ fontSize: `${spineTitleSize(title)}em` }}>
        <span>{title}</span>
      </div>
      <div className={styles.foot}>
        <span className={styles.brand}>REWIND</span>
        <span className={styles.vhs}>VHS</span>
      </div>
    </div>
  );
}
