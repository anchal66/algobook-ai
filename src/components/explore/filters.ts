/** Explore filter model (Module 05 U-13): URL ⇄ state, pure filtering/sorting over the catalog. Unit-testable. */
import type { CatalogRow, ItemStatus } from "@/lib/app/api";
import type { Difficulty } from "@/types";

export type SortKey = "number" | "title" | "difficulty" | "acceptance" | "rating" | "newest";
export type StatusFilter = "" | "solved" | "attempting" | "todo";
export interface ExploreFilters {
  q: string; difficulty: Difficulty | ""; status: StatusFilter; topics: string[]; company: string;
  minRating: number | null; maxRating: number | null; sort: SortKey; dir: "asc" | "desc";
}
export const DEFAULT_FILTERS: ExploreFilters = { q: "", difficulty: "", status: "", topics: [], company: "", minRating: null, maxRating: null, sort: "number", dir: "asc" };

export function fromSearchParams(sp: URLSearchParams): ExploreFilters {
  const num = (k: string) => { const v = sp.get(k); const n = v ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
  const diff = sp.get("difficulty");
  const status = sp.get("status");
  const sort = sp.get("sort");
  return {
    q: sp.get("q") ?? "",
    difficulty: diff === "Easy" || diff === "Medium" || diff === "Hard" ? diff : "",
    status: status === "solved" || status === "attempting" || status === "todo" ? status : "",
    topics: (sp.get("topics") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    company: sp.get("company") ?? "",
    minRating: num("minRating"), maxRating: num("maxRating"),
    sort: (["number", "title", "difficulty", "acceptance", "rating", "newest"] as SortKey[]).includes(sort as SortKey) ? (sort as SortKey) : "number",
    dir: sp.get("dir") === "desc" ? "desc" : "asc",
  };
}

export function toSearchParams(f: ExploreFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.difficulty) sp.set("difficulty", f.difficulty);
  if (f.status) sp.set("status", f.status);
  if (f.topics.length) sp.set("topics", f.topics.join(","));
  if (f.company) sp.set("company", f.company);
  if (f.minRating !== null) sp.set("minRating", String(f.minRating));
  if (f.maxRating !== null) sp.set("maxRating", String(f.maxRating));
  if (f.sort !== "number") sp.set("sort", f.sort);
  if (f.dir !== "asc") sp.set("dir", f.dir);
  return sp;
}

export type StatusMap = Map<string, ItemStatus>;
const DIFF_ORDER: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };

export function statusOf(id: string, statuses: StatusMap): ItemStatus {
  return statuses.get(id) ?? "todo";
}

export function applyFilters(rows: CatalogRow[], f: ExploreFilters, statuses: StatusMap): CatalogRow[] {
  const q = f.q.trim().toLowerCase();
  const qNum = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const out = rows.filter((r) => {
    if (f.difficulty && r.difficulty !== f.difficulty) return false;
    if (f.status && statusOf(r.id, statuses) !== f.status) return false;
    if (f.company && !r.companies.includes(f.company)) return false;
    if (f.topics.length && !f.topics.every((t) => r.tags.includes(t))) return false;
    if (f.minRating !== null && r.rating < f.minRating) return false;
    if (f.maxRating !== null && r.rating > f.maxRating) return false;
    if (q) {
      if (qNum !== null && r.number === qNum) return true;
      if (!r.title.toLowerCase().includes(q) && !r.slug.includes(q) && !r.tags.some((t) => t.includes(q))) return false;
    }
    return true;
  });
  const dir = f.dir === "asc" ? 1 : -1;
  out.sort((a, b) => {
    switch (f.sort) {
      case "title": return dir * a.title.localeCompare(b.title);
      case "difficulty": return dir * (DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]) || (a.number ?? 0) - (b.number ?? 0);
      case "acceptance": return dir * (a.acceptanceRate - b.acceptanceRate);
      case "rating": return dir * (a.rating - b.rating);
      case "newest": return -dir * a.createdAt.localeCompare(b.createdAt);
      default: return dir * ((a.number ?? 1e9) - (b.number ?? 1e9));
    }
  });
  return out;
}

export function topicCounts(rows: CatalogRow[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function companyCounts(rows: CatalogRow[]): { company: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const c of r.companies) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()].map(([company, count]) => ({ company, count })).sort((a, b) => b.count - a.count);
}

export function pickRandom<T>(rows: T[], rand: () => number = Math.random): T | null {
  return rows.length ? rows[Math.floor(rand() * rows.length)] : null;
}
