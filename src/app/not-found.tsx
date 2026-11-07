import { GlitchText } from "@/components/site/GlitchText";
import { ParticleLink } from "@/components/site/ParticleButton";

export default function NotFound() {
  return (
    <section className="page" style={{ padding: "96px var(--gutter)", display: "flex", flexDirection: "column", gap: 20, alignItems: "flex-start" }}>
      <span className="lbl" style={{ color: "var(--cobalt)" }}>
        Error 404
      </span>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: "clamp(44px, 6vw, 84px)", lineHeight: 1, letterSpacing: "-0.025em" }}>
        <GlitchText text="This tape isn’t on the shelf." trigger="idle" intensity="medium" />
      </h1>
      <p style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.5, maxWidth: "42ch" }}>
        It may have been returned to the wrong aisle. Try the search box, or head back to the front of the store.
      </p>
      <ParticleLink className="lbl btn btn-solid" href="/">
        ← Back to the shelves
      </ParticleLink>
    </section>
  );
}
