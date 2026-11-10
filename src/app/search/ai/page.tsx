import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { CLERK_STATUS_ID } from "@/components/clerk/Announce";
import { ClerkAnswer, ClerkSearching, ExampleQueries } from "@/components/clerk/ClerkAnswer";
import { ClerkCounter } from "@/components/clerk/ClerkCounter";
import { Crumbs, PageHead } from "@/components/browse/PageHead";
import { askTheClerk, shelvesOf } from "@/lib/catalog";

/*
 * /search/ai?q=…[&f=…]: ask the clerk. The answer is rendered on the server, so the URL is the
 * whole state: results can be shared and survive a refresh.
 *
 * Rendering it can call the model, so the page is kept out of search engines (noindex) and every
 * link to it is prefetch={false}.
 */

export const metadata: Metadata = {
  title: "Ask the clerk",
  description: "Ask Rewind's clerk for films in plain English.",
  robots: { index: false, follow: false },
};

/**
 * Seconds the host may give this page's server work. The worst case is a provider timing out
 * (10s), the next one using its whole budget (15s, see interpret.ts) and the TMDB searches.
 */
export const maxDuration = 60;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function AskTheClerkPage(props: PageProps<"/search/ai">) {
  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Home" }, { label: "Ask the clerk" }]} />
      <PageHead
        kicker="The counter"
        title="Ask the clerk"
        lede="Tell the clerk what you're in the mood for, in your own words. They'll pull the tapes and tell you what they looked for."
      />
      {/* outside the streamed parts, so it's on the page before anything is announced */}
      <p id={CLERK_STATUS_ID} className="sr-only" role="status" aria-live="polite" />
      {/* the query string is only known per request, so everything below waits for it */}
      <Suspense fallback={<ClerkCounter />}>
        <Counter {...props} />
      </Suspense>
    </>
  );
}

async function Counter({ searchParams }: PageProps<"/search/ai">) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim() ?? "";
  const f = one(sp.f);

  return (
    <>
      {/* keyed, so the box shows the request after back/forward navigation too */}
      <ClerkCounter key={q} initialQuery={q} />
      {q ? (
        <Suspense key={`${q}|${f ?? ""}`} fallback={<ClerkSearching query={q} />}>
          <Answer q={q} f={f} />
        </Suspense>
      ) : (
        <ExampleQueries title="Not sure? Try one of these" />
      )}
    </>
  );
}

async function Answer({ q, f }: { q: string; f?: string }) {
  // the answer is per request (it reads today's date and the visitor's IP): never prerendered
  await connection();
  const h = await headers();
  // on Vercel x-forwarded-for is set by the platform; its first entry is the visitor
  const visitor = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const answer = await askTheClerk(q, f, visitor);
  return <ClerkAnswer answer={answer} rows={shelvesOf(answer.films)} />;
}
