import type { Metadata } from "next";
import { ComingSoon } from "@/components/browse/ComingSoon";
import { NewArrivalsView } from "@/components/browse/NewArrivalsView";
import { SpineRow } from "@/components/vhs/SpineRow";
import { getNewArrivals, shelvesOf } from "@/lib/catalog";
import styles from "./new.module.css";

export const metadata: Metadata = {
  title: "New arrivals",
  description: "What's in cinemas now, and what's due on the shelf soon.",
};

const COMING_SOON_LIMIT = 30;

export default async function NewArrivalsPage() {
  const { nowShowing, comingSoon } = await getNewArrivals();
  const rows = shelvesOf(nowShowing);
  const soon = comingSoon.slice(0, COMING_SOON_LIMIT);

  return (
    <NewArrivalsView
      nowCount={nowShowing.length}
      soonCount={soon.length}
      nowShowing={
        rows.length > 0 ? (
          <div className={styles.rows}>
            {rows.map((row, i) => (
              <SpineRow key={i} films={row} label={`Now showing, shelf ${i + 1}`} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>Nothing new on the shelf right now.</p>
        )
      }
      comingSoon={<ComingSoon films={soon} />}
    />
  );
}
