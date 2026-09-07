"use client";
/** ⚙ Settings modal (Module 03 §1.9 / W-21): sidebar Dynamic Layout | Code Editor | Shortcuts | Advanced | Timer. */
import { useState } from "react";
import { Code2, Keyboard, LayoutGrid, SlidersHorizontal, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import { DynamicLayoutSettings } from "@/components/workspace/Settings/DynamicLayoutSettings";
import { CodeEditorSettings } from "@/components/workspace/Settings/CodeEditorSettings";
import { ShortcutsSettings } from "@/components/workspace/Settings/ShortcutsSettings";
import { AdvancedSettings } from "@/components/workspace/Settings/AdvancedSettings";
import { TimerSettings } from "@/components/workspace/Settings/TimerSettings";

type Section = "layout" | "editor" | "shortcuts" | "advanced" | "timer";
const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "layout", label: "Dynamic Layout", icon: LayoutGrid },
  { id: "editor", label: "Code Editor", icon: Code2 },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "advanced", label: "Advanced", icon: SlidersHorizontal },
  { id: "timer", label: "Timer", icon: Timer },
];

export function SettingsDialog() {
  const open = useWorkspace((s) => s.settingsOpen);
  const setUi = useWorkspace((s) => s.setUi);
  const [section, setSection] = useState<Section>("layout");
  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ settingsOpen: o })}>
      <DialogContent className="flex h-[min(620px,90vh)] w-[min(880px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Workspace settings</DialogDescription>
        <nav aria-label="Settings sections" className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-line/60 bg-ws-bar/40 p-2">
          <p className="px-2 py-2 text-sm font-semibold text-fg-1">Settings</p>
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => setSection(s.id)} aria-current={section === s.id ? "page" : undefined} className={cn("flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm transition-colors", section === s.id ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:bg-ws-hover hover:text-fg-1")}>
              <s.icon className="size-4" /> {s.label}
            </button>
          ))}
        </nav>
        <div className="ws-scroll min-w-0 flex-1 overflow-y-auto px-6 py-4">
          <h2 className="mb-2 text-base font-semibold text-fg-1">{SECTIONS.find((s) => s.id === section)?.label}</h2>
          {section === "layout" && <DynamicLayoutSettings />}
          {section === "editor" && <CodeEditorSettings />}
          {section === "shortcuts" && <ShortcutsSettings />}
          {section === "advanced" && <AdvancedSettings />}
          {section === "timer" && <TimerSettings />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
