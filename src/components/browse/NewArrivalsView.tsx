"use client";

import { type ReactNode, useState } from "react";
import { ShelfTabs } from "../site/ShelfTabs";
import { PageHead } from "./PageHead";
import styles from "./NewArrivalsView.module.css";

/** The heading follows the tab: what's in now, or what's on order. */
const HEADS = {
  now: {
    kicker: "New arrivals",
    title: "Just in",
    lede: "What’s in cinemas right now, fresh on the shelf. Updated every few hours.",
  },
  soon: {
    kicker: "Coming soon",
    title: "On order",
    lede: "Films that haven’t opened yet, grouped by the week they arrive. Updated every few hours.",
  },
} as const;

type TabId = keyof typeof HEADS;

/** The new-arrivals page body: a heading that changes with the "Now showing" / "Coming soon" tabs. */
export function NewArrivalsView({
  nowShowing,
  comingSoon,
  nowCount,
  soonCount,
}: {
  nowShowing: ReactNode;
  comingSoon: ReactNode;
  nowCount: number;
  soonCount: number;
}) {
  const [tab, setTab] = useState<TabId>("now");
  const head = HEADS[tab];

  return (
    <>
      {/* keyed by tab, so the new heading fades in instead of the words just swapping */}
      <div key={tab} className={styles.head}>
        <PageHead kicker={head.kicker} title={head.title} lede={head.lede} />
      </div>
      <section className={`page ${styles.body}`}>
        <ShelfTabs
          label="New arrivals"
          onChange={(id) => setTab(id as TabId)}
          tabs={[
            { id: "now", title: "Now showing", count: nowCount, content: nowShowing },
            { id: "soon", title: "Coming soon", count: soonCount, content: comingSoon },
          ]}
        />
      </section>
    </>
  );
}
