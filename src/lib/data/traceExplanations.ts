import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

/** Cache of visualizer narrations keyed by a hash of (problem, language, code, question, window). Best-effort. */
const COL = "traceExplanations";

export function explanationKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export async function get(key: string): Promise<{ text: string; model: string } | null> {
  try {
    const snap = await adminDb.collection(COL).doc(key).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return typeof d.text === "string" ? { text: d.text, model: String(d.model ?? "") } : null;
  } catch {
    return null;
  }
}

export async function set(key: string, text: string, model: string, meta: { problemId: string; uid: string }): Promise<void> {
  try {
    await adminDb.collection(COL).doc(key).set({ text, model, problemId: meta.problemId, uid: meta.uid, createdAt: Timestamp.now() });
  } catch (e) {
    console.warn(JSON.stringify({ evt: "traceExplanations.set_failed", message: (e as Error).message }));
  }
}
