import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif, Newsreader } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import "lenis/dist/lenis.css";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Rewind — Film Database",
    template: "%s — Rewind",
  },
  description: "A film database shelved on VHS. Browse films, casts and directors one tape at a time.",
};

/** The saved theme, or the system setting when nothing is saved. Key matches THEME_KEY in ThemeSwitch. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("rewind-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [interTight, newsreader, instrument].map((f) => f.variable).join(" ");
  return (
    // the inline script sets data-theme before first paint, so React must accept the DOM's value
    <html lang="en" className={fonts} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SmoothScroll />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
