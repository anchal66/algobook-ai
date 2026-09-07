"use client";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useSettings, type ThemePref } from "@/store/settings";
import { auth } from "@/lib/firebase";
import { patchSettings } from "@/lib/workspace/api";
import { cn } from "@/lib/utils";

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
  const opts: { v: ThemePref; label: string; icon: typeof Sun }[] = [
    { v: "light", label: "Light", icon: Sun }, { v: "dark", label: "Dark", icon: Moon }, { v: "system", label: "System", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-[8px] bg-surface-2 p-[3px]", className)}>
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={theme === o.v}
          type="button"
          onClick={() => set(o.v)}
          className={cn("flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium transition-colors", theme === o.v ? "bg-card text-text-1 shadow-sm" : "text-text-2 hover:text-text-1")}
        >
          <o.icon className="size-4" />{o.label}
        </button>
      ))}
    </div>
  );
}
