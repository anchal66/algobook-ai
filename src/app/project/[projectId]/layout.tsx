import type { ReactNode } from "react";

/**
 * Project routes render their own chrome: the workspace (`/solve/*`) has the LeetCode-style top bar
 * and the insights page has its own header. The v1 ProjectHeader and the attendance modal (D-07) are gone.
 */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  return children;
}
