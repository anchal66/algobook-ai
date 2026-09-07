"use client";
/** Local draft mirror (Module 03 W-07): written on every keystroke, reconciled with the server draft on load. */
import type { Language } from "@/types";

export interface LocalDraft { code: string; updatedAt: number }

const key = (uid: string, problemId: string, lang: Language) => `ab:draft:${uid}:${problemId}:${lang}`;

export function readLocalDraft(uid: string, problemId: string, lang: Language): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key(uid, problemId, lang));
    if (!raw) return null;
    const v = JSON.parse(raw) as LocalDraft;
    return typeof v.code === "string" && typeof v.updatedAt === "number" ? v : null;
  } catch { return null; }
}

export function writeLocalDraft(uid: string, problemId: string, lang: Language, code: string): void {
  try { localStorage.setItem(key(uid, problemId, lang), JSON.stringify({ code, updatedAt: Date.now() })); } catch { /* quota */ }
}

export function clearLocalDraft(uid: string, problemId: string, lang: Language): void {
  try { localStorage.removeItem(key(uid, problemId, lang)); } catch { /* ignore */ }
}

/** Picks the newer of the local and server copies; falls back to the starter. */
export function resolveInitialCode(opts: { local: LocalDraft | null; server: { code: string; updatedAt: string } | null; starter: string }): string {
  const { local, server, starter } = opts;
  const serverAt = server ? Date.parse(server.updatedAt) : 0;
  if (local && (!server || local.updatedAt >= serverAt)) return local.code;
  if (server) return server.code;
  return starter;
}
