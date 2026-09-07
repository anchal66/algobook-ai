"use client";
/** GA4 event helper (Module 03 W-32). No-op when gtag is not loaded. */

export type AnalyticsEvent =
  | { name: "run"; params: { language: string; cases: number } }
  | { name: "submit"; params: { language: string; verdict: string; passed: number; total: number } }
  | { name: "hint"; params: { level: number; source: string } }
  | { name: "editorial_view"; params: { problemId: string } }
  | { name: "chat_msg"; params: { length: number } }
  | { name: "completion_accept"; params: { language: string; chars: number } }
  | { name: "next_problem"; params: { source: string; latencyMs: number } }
  // Module 05 (U-23)
  | { name: "signup"; params?: { method: string } }
  | { name: "login"; params?: { method: string } }
  | { name: "project_create"; params?: { template: string | null; durationDays: number } }
  | { name: "first_solve"; params?: { language: string } }
  | { name: "upgrade_click"; params?: { source: string } }
  | { name: "checkout_start"; params?: { plan: string } }
  | { name: "contact_submit"; params?: Record<string, never> }
  | { name: "demo_run"; params?: { language: string } }
  | { name: "explore_pick_random"; params?: Record<string, never> };

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

export function track<E extends AnalyticsEvent>(name: E["name"], params?: E["params"]): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag === "function") {
    try { gtag("event", name, params); } catch { /* ignore */ }
  }
}
