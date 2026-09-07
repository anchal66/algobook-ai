"use client";
/** GA4 event helper (Module 03 W-32). No-op when gtag is not loaded. */

export type AnalyticsEvent =
  | { name: "run"; params: { language: string; cases: number } }
  | { name: "submit"; params: { language: string; verdict: string; passed: number; total: number } }
  | { name: "hint"; params: { level: number; source: string } }
  | { name: "editorial_view"; params: { problemId: string } }
  | { name: "chat_msg"; params: { length: number } }
  | { name: "completion_accept"; params: { language: string; chars: number } }
  | { name: "next_problem"; params: { source: string; latencyMs: number } };

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

export function track<E extends AnalyticsEvent>(name: E["name"], params: E["params"]): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag === "function") {
    try { gtag("event", name, params); } catch { /* ignore */ }
  }
}
