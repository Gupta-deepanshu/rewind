import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif, Newsreader, Noto_Sans_JP } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
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

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: "500",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Rewind — Film Database",
    template: "%s — Rewind",
  },
  description: "A film database shelved on VHS. Browse films, casts and directors one tape at a time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [interTight, newsreader, instrument, notoJp].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
