import type { CaseStatus } from "@/types";

export const VERDICT_LABEL: Record<CaseStatus, string> = {
  AC: "Accepted", WA: "Wrong Answer", RE: "Runtime Error", CE: "Compile Error", TLE: "Time Limit Exceeded", MLE: "Memory Limit Exceeded", IE: "Internal Error",
};

export const VERDICT_CLASS: Record<CaseStatus, string> = {
  AC: "text-accepted", WA: "text-wrong", RE: "text-wrong", CE: "text-wrong", TLE: "text-wrong", MLE: "text-wrong", IE: "text-medium",
};

export function formatMemory(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
