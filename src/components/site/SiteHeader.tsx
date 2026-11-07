import Link from "next/link";
import { GlitchText } from "./GlitchText";
import { SearchPalette } from "./SearchPalette";
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
      <nav aria-label="Main" className={styles.nav}>
        <Link className="lbl" href="/#todays-picks">
          Today’s Picks
        </Link>
        <Link className="lbl" href="/#aisles">
          Aisles
        </Link>
        <Link className="lbl" href="/#directors">
          Directors
        </Link>
      </nav>
      <div className={styles.tools}>
        <SearchPalette />
        <ThemeSwitch />
      </div>
    </header>
  );
}
