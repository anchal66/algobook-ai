"use client";
/** Settings → Shortcuts (Module 03 §1.9 / W-22): rendered from the registry, platform-aware labels, per-shortcut toggles. */
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { SHORTCUTS, SHORTCUT_GROUP_LABELS, comboLabel, isMac, type ShortcutGroup } from "@/lib/editor/shortcuts";
import { useSettings } from "@/store/settings";
import { Segmented } from "@/components/workspace/Settings/SettingRow";

const GROUPS: ShortcutGroup[] = ["general", "debug", "algobook"];

export function ShortcutsSettings() {
  const toggles = useSettings((s) => s.shortcuts);
  const setShortcut = useSettings((s) => s.setShortcut);
  const [platform, setPlatform] = useState<"mac" | "win">("mac");
  useEffect(() => { setPlatform(isMac() ? "mac" : "win"); }, []);

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <p className="text-xs text-fg-3">Shortcuts work everywhere in the workspace, including inside the editor.</p>
        <Segmented<"mac" | "win"> ariaLabel="Platform" value={platform} onChange={setPlatform} options={[{ value: "mac", label: "macOS" }, { value: "win", label: "Windows / Linux" }]} />
      </div>
      {GROUPS.map((g) => (
        <section key={g} className="mb-4">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-3">{SHORTCUT_GROUP_LABELS[g]}</h3>
          <div className="divide-y divide-line/60 rounded-[8px] border border-line/60">
            {SHORTCUTS.filter((s) => s.group === g).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-sm text-fg-1">{s.label}</span>
                <kbd className="rounded-[5px] border border-line bg-bg-2 px-2 py-0.5 font-mono text-xs text-fg-2">{comboLabel(s.combo, platform === "mac")}</kbd>
                <span className="w-9">{s.toggleable && <Switch checked={toggles[s.id] !== false} onCheckedChange={(v) => setShortcut(s.id, v)} aria-label={`Enable ${s.label}`} />}</span>
              </div>
            ))}
          </div>
          {g === "debug" && <p className="mt-1 text-[11px] text-fg-3">The debugger is coming soon; these bindings are reserved.</p>}
        </section>
      ))}
    </div>
  );
}
