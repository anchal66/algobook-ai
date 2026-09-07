"use client";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { CommandPaletteProvider } from "@/components/shell/CommandPalette";

/** Client providers shared by every route (Module 05). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <TooltipProvider delayDuration={250}>
            <CommandPaletteProvider>{children}</CommandPaletteProvider>
          </TooltipProvider>
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ classNames: { toast: "!rounded-[12px] !border-line !bg-card !text-text-1 !shadow-2xl" } }} />
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
