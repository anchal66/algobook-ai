import { ImageResponse } from "next/og";

/** Default Open Graph image (Module 05 U-02). Per-user images live in `[username]/opengraph-image.tsx`. */
export const alt = "AlgoBook — practice like it's the real interview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 72, background: "#0f0f10", color: "#f5f5f5", fontFamily: "Inter, system-ui, sans-serif", position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: -120, top: -160, width: 520, height: 520, borderRadius: 9999, background: "#6366f1", opacity: 0.35, filter: "blur(120px)" }} />
        <div style={{ position: "absolute", right: -80, bottom: -200, width: 520, height: 520, borderRadius: 9999, background: "#22d3ee", opacity: 0.25, filter: "blur(120px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #22d3ee)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <path d="M13.5 5.5 5 16l8.5 10.5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 5.5 27 16l-8.5 10.5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.5 5.5h5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
              <circle cx="16" cy="18" r="3.4" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>AlgoBook</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>Practice like it&apos;s the real interview.</div>
          <div style={{ fontSize: 30, color: "#a3a3a3", lineHeight: 1.3 }}>
            AI-verified problems, a LeetCode-parity editor, an AI tutor, spaced repetition and a rating — in Java, Python, C++ and JavaScript.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#a3a3a3" }}>
          <span style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid #3e3e3e" }}>Verified before you see it</span>
          <span style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid #3e3e3e" }}>4 languages</span>
          <span style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid #3e3e3e" }}>Free to start</span>
        </div>
      </div>
    ),
    size,
  );
}
