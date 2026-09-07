"use client";
/** Human copy for API errors on the app pages (Module 05 audit): quotas say when they reset, plan gates point to the plan page. */
import { ApiError } from "@/lib/api-client";
import { fmtDate } from "@/lib/app/format";

export interface FriendlyError { title: string; message: string; action?: { label: string; href: string } }

export function describeError(e: unknown, fallback = "Something went wrong. Please try again."): FriendlyError {
  if (e instanceof ApiError) {
    const details = (e.details ?? {}) as { resetAt?: string };
    switch (e.code) {
      case "QUOTA_EXCEEDED": return { title: "Daily limit reached", message: `You've used today's allowance for this feature.${details.resetAt ? ` It resets at ${fmtDate(details.resetAt, { hour: "2-digit", minute: "2-digit" })} (your local time).` : " It resets at 00:00 UTC."}`, action: { label: "See plans", href: "/settings#plan" } };
      case "PAYMENT_REQUIRED": return { title: "Pro feature", message: "This is included in the Pro plan.", action: { label: "Upgrade", href: "/settings#plan" } };
      case "UNAUTHENTICATED": return { title: "Signed out", message: "Your session expired. Please sign in again.", action: { label: "Sign in", href: "/login" } };
      case "FORBIDDEN": return { title: "Not allowed", message: e.message };
      case "NOT_FOUND": return { title: "Not found", message: e.message };
      case "CONFLICT": return { title: "Already in progress", message: e.message };
      case "UPSTREAM": return { title: "Service busy", message: e.message || "A service we depend on is temporarily unavailable. Please try again in a moment." };
      default: return { title: "Error", message: e.message || fallback };
    }
  }
  return { title: "Error", message: (e as Error)?.message || fallback };
}

/** One-line variant for toasts. */
export function errorText(e: unknown, fallback?: string): string {
  const f = describeError(e, fallback);
  return f.title === "Error" ? f.message : `${f.title}: ${f.message}`;
}
