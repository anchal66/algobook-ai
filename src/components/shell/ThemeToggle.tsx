"use client";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useSettings, type ThemePref } from "@/store/settings";
import { auth } from "@/lib/firebase";
import { patchSettings } from "@/lib/workspace/api";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";

/** Cycles dark → light → system; keeps the workspace's editor theme setting in sync so both surfaces agree. */
export function useThemePref() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const setEditor = useSettings((s) => s.setEditor);
  const set = (t: ThemePref) => {
    setTheme(t);
    setEditor({ theme: t });
    // Flush immediately (the store syncs after a 1.5 s debounce) so opening the workspace right away keeps the choice.
    if (auth.currentUser) void patchSettings({ editor: { theme: t === "dark" ? "algobook-dark" : t === "light" ? "algobook-light" : "system" } }).catch(() => undefined);
  };
  return { theme: (theme ?? "dark") as ThemePref, resolvedTheme, set };
}

export function ThemeToggle({ className, showLabel }: { className?: string; showLabel?: boolean }) {
  const { theme, set } = useThemePref();
  const next: ThemePref = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => set(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      className={cn("flex h-8 items-center gap-2 rounded-[8px] px-2 text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1", className)}
    >
      <Icon className="size-4" />
      {showLabel && <span className="text-sm capitalize">{theme}</span>}
    </button>
  );
}

export function ThemeSegmented({ className }: { className?: string }) {
  const { theme, set } = useThemePref();
  return <Segmented<ThemePref> label="Theme" className={className} value={theme} onChange={set} options={[{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }]} />;
}
