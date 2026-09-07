"use client";
/** Settings → Advanced (Module 03 §1.9): real-time resizing, multiple instances (Lab), cloud layout. */
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/store/settings";
import { isPro, useMe } from "@/store/me";
import { SettingRow } from "@/components/workspace/Settings/SettingRow";

export function AdvancedSettings() {
  const layout = useSettings((s) => s.layout);
  const setLayout = useSettings((s) => s.setLayout);
  const pro = isPro(useMe((s) => s.me));
  return (
    <div className="divide-y divide-line/60">
      <SettingRow label="Real-time resizing" description="Off: a ghost line follows the pointer and the layout applies on release.">
        <Switch checked={layout.realtimeResize} onCheckedChange={(v) => setLayout({ realtimeResize: v })} aria-label="Real-time resizing" />
      </SettingRow>
      <SettingRow label="Open multiple instances in new tab" description="Lab · problem links from the list open in a new tab.">
        <Switch checked={layout.multiInstance} onCheckedChange={(v) => setLayout({ multiInstance: v })} aria-label="Open multiple instances" />
      </SettingRow>
      <SettingRow label="Save custom layout (cloud)" description={pro ? "Your panel sizes follow you across devices." : "Always on for Pro; free plans keep the layout on this device."}>
        <Switch checked={pro ? layout.cloudLayout : false} disabled={!pro} onCheckedChange={(v) => setLayout({ cloudLayout: v })} aria-label="Save custom layout to the cloud" />
      </SettingRow>
    </div>
  );
}
