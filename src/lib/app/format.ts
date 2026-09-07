/** Formatting helpers shared by the app pages (Module 05). */

/** Level = 1 + floor(sqrt(xp / 50)) (Module 04). Returns progress towards the next level. */
export function levelProgress(xp: number) {
  const level = 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50));
  const cur = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, cur, next, toNext: Math.max(0, next - xp), progress: next > cur ? Math.min(1, (xp - cur) / (next - cur)) : 1 };
}

export function pct(n: number, d: number, digits = 0): string {
  if (!d) return "0%";
  return `${((n / d) * 100).toFixed(digits)}%`;
}

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtDuration(sec: number): string {
  if (!sec || sec < 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(sec)}s`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, opts);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.round((Date.now() - t) / 1000);
  if (diff < 60) return "just now";
  const units: [number, string][] = [[60, "m"], [60, "h"], [24, "d"], [7, "w"], [4.35, "mo"], [12, "y"]];
  let v = diff / 60, i = 0;
  for (; i < units.length - 1 && v >= units[i + 1][0]; i++) v /= units[i + 1][0];
  return `${Math.floor(v)}${units[i][1]} ago`;
}

/** UTC date key for "today", matching the server's `todayKey`. */
export function todayKeyUtc(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Seconds until the next UTC midnight (daily reset). */
export function secondsToUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, Math.floor((next - now.getTime()) / 1000));
}

export function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const INR = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
