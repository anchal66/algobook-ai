"use client";
/**
 * Bookmarks and 👍/👎 reactions (Module 03 §1.3). Kept in localStorage per user: Module 01 has no
 * `users.bookmarks` route yet; Module 05 (profile / explore) adds the server copy and this helper
 * becomes the write-through cache.
 */
const key = (uid: string, what: "bookmarks" | "reactions") => `ab:${what}:${uid}`;

function read<T>(k: string, fallback: T): T {
  try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
}

export function isBookmarked(uid: string, problemId: string): boolean {
  return read<string[]>(key(uid, "bookmarks"), []).includes(problemId);
}
export function toggleBookmark(uid: string, problemId: string): boolean {
  const list = read<string[]>(key(uid, "bookmarks"), []);
  const next = list.includes(problemId) ? list.filter((x) => x !== problemId) : [...list, problemId];
  write(key(uid, "bookmarks"), next);
  return next.includes(problemId);
}

export type Reaction = "up" | "down" | null;
export function getReaction(uid: string, problemId: string): Reaction {
  return read<Record<string, Reaction>>(key(uid, "reactions"), {})[problemId] ?? null;
}
export function setReaction(uid: string, problemId: string, r: Reaction): void {
  const all = read<Record<string, Reaction>>(key(uid, "reactions"), {});
  all[problemId] = r;
  write(key(uid, "reactions"), all);
}
