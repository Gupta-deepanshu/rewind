import Image from "next/image";
import { coverTitleSize, vhsLook, type Art, type Scheme } from "@/lib/vhs";
import styles from "./Cover.module.css";

type CoverProps = {
  title: string;
  year: number;
  directorName?: string;
  /** Poster URL. With one, the box is a rental-store case around the real poster. */
  poster?: string;
  /** Rendered width of the box, for picking the image size. */
  sizes?: string;
  /** Load the poster straight away (the 3D shelf can't rely on lazy loading). */
  eager?: boolean;
};

/**
 * A VHS box front, sized in em: 17.6em × 33.4em (the VHS box ratio). The parent sets font-size;
 * 10px → 176 × 334 px. With a poster it shows the poster; without one, generated art.
 */
export function Cover(props: CoverProps) {
  return props.poster ? <PosterCover {...props} poster={props.poster} /> : <DrawnCover {...props} />;
}

const filmBy = (name: string) => `${/^[AEIOU]/i.test(name) ? "An" : "A"} ${name} Film`;

/** The real poster in a rental-store case: brand band, poster, label with title and year. */
function PosterCover({ title, year, directorName, poster, sizes = "220px", eager }: CoverProps & { poster: string }) {
  return (
    <div className={`${styles.cover} ${styles.posterCover}`}>
      <div className={styles.band}>
        <span>Rewind Video</span>
        <span>Hi-Fi Stereo</span>
      </div>
      <div className={styles.poster}>
        <Image src={poster} alt={`${title} poster`} fill sizes={sizes} loading={eager ? "eager" : "lazy"} />
      </div>
      <div className={styles.label}>
        <div className={styles.labelText}>
          <span className={styles.labelTitle}>{title}</span>
          <span className={styles.labelMeta}>{[year || "", directorName].filter(Boolean).join(" · ")}</span>
        </div>
        <span className={styles.vhs}>VHS</span>
      </div>
    </div>
  );
}

/** Generated cover art, for films without a poster. */
function DrawnCover({ title, year, directorName }: CoverProps) {
  const look = vhsLook(title);
  return (
    <div className={`${styles.cover} ${styles[look.scheme]}`}>
      <span className={styles.by}>{directorName ? filmBy(directorName) : "Feature Presentation"}</span>
      <span className={styles.title} style={{ fontSize: `${coverTitleSize(title)}em` }}>
        {title}
      </span>
      <CoverArt art={look.art} className={styles.art} />
      <div className={styles.foot}>
        <span className={styles.year}>{year}</span>
        <span className={styles.vhs}>VHS</span>
      </div>
    </div>
  );
}

/** The screen-printed picture on a generated cover. Also used for stills on the back of the box. */
export function CoverArt({
  art,
  scheme,
  className = "",
}: {
  art: Art;
  /** Palette, when the art is used outside a cover. */
  scheme?: Scheme;
  className?: string;
}) {
  return (
    <div className={`${styles.artBox} ${styles[art]} ${scheme ? styles[scheme] : ""} ${className}`} aria-hidden="true">
      <div className={styles.a} />
      <div className={styles.b} />
      <div className={styles.c} />
      <div className={styles.d} />
    </div>
  );
}
