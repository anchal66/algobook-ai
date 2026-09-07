import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

/** Signed-in app routes share the nav rail + top bar shell (Module 05 U-08). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
