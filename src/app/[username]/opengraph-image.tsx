import { ImageResponse } from "next/og";
import { getByUsername, RESERVED_USERNAMES } from "@/lib/data/users";

/** Per-user Open Graph card (Module 05 U-16). */
export const alt = "AlgoBook profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = username.toLowerCase();
  const user = RESERVED_USERNAMES.has(u) ? null : await getByUsername(u);
  const name = user?.publicProfile ? user.displayName || user.username : "AlgoBook";
  const s = user?.publicProfile ? user.stats : null;
  const stat = (label: string, value: string | number) => (
    <div style={{ display: "flex", flexDirection: "column", padding: "20px 28px", borderRadius: 20, border: "1px solid #3e3e3e", background: "#1a1a1a", minWidth: 200 }}>
      <span style={{ fontSize: 44, fontWeight: 700, color: "#f5f5f5" }}>{value}</span>
      <span style={{ fontSize: 22, color: "#a3a3a3" }}>{label}</span>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0f0f10", color: "#f5f5f5", fontFamily: "Inter, system-ui, sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", left: -120, top: -160, width: 520, height: 520, borderRadius: 9999, background: "#6366f1", opacity: 0.3, filter: "blur(120px)" }} />
        <div style={{ position: "absolute", right: -80, bottom: -200, width: 520, height: 520, borderRadius: 9999, background: "#22d3ee", opacity: 0.22, filter: "blur(120px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {user?.publicProfile && user.photoURL ? <img src={user.photoURL} width={120} height={120} style={{ borderRadius: 9999, border: "4px solid #3e3e3e" }} alt="" /> : <div style={{ width: 120, height: 120, borderRadius: 9999, background: "linear-gradient(135deg,#6366f1,#22d3ee)" }} />}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>{name}</span>
            {user?.publicProfile && <span style={{ fontSize: 30, color: "#a3a3a3" }}>@{user.username} · algobook.ai</span>}
          </div>
        </div>
        {s ? (
          <div style={{ display: "flex", gap: 20 }}>{stat("solved", s.totalSolved)}{stat("rating", Math.round(s.rating))}{stat("best streak", `${s.longestStreak}d`)}{stat("level", s.level)}</div>
        ) : (
          <div style={{ fontSize: 40, color: "#a3a3a3" }}>Practice like it&apos;s the real interview.</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#a3a3a3" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#22d3ee)" }} /> AlgoBook — AI-verified coding interview practice
        </div>
      </div>
    ),
    size,
  );
}
