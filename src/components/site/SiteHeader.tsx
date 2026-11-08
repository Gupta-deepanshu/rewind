import Link from "next/link";
import { GlitchText } from "./GlitchText";
import { HeaderNav } from "./HeaderNav";
import { SearchPalette } from "./SearchPalette";
import { SurpriseButton } from "./SurpriseButton";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={`page ${styles.header}`}>
      <Link href="/" className={styles.logo} aria-label="Rewind film database, home">
        <span className={styles.mark}>
          <GlitchText text="REWIND" trigger="hover" intensity="medium" />
        </span>
        <span className={styles.sub}>
          <span className="lbl">Film Database</span>
        </span>
      </Link>
      <HeaderNav />
      <div className={styles.tools}>
        <SearchPalette />
        <SurpriseButton />
        <ThemeSwitch />
      </div>
    </header>
  );
}
