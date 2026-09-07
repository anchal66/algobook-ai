"use client";
/** Settings → Timer (Module 03 §1.9 / W-23): default mode, auto-start, visibility. */
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, type TimerMode } from "@/store/settings";
import { SettingRow, Segmented } from "@/components/workspace/Settings/SettingRow";

export function TimerSettings() {
  const timer = useSettings((s) => s.timer);
  const setTimer = useSettings((s) => s.setTimer);
  return (
    <div className="divide-y divide-line/60">
      <SettingRow label="Default mode">
        <Segmented<TimerMode> ariaLabel="Timer mode" value={timer.mode} onChange={(v) => setTimer({ mode: v })} options={[{ value: "stopwatch", label: "Stopwatch" }, { value: "countdown", label: "Countdown" }]} />
      </SettingRow>
      {timer.mode === "countdown" && (
        <SettingRow label="Countdown length">
          <Select value={String(timer.countdownMin)} onValueChange={(v) => setTimer({ countdownMin: Number(v) })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[15, 20, 25, 30, 45, 60].map((n) => <SelectItem key={n} value={String(n)}>{n} min</SelectItem>)}</SelectContent>
          </Select>
        </SettingRow>
      )}
      <SettingRow label="Auto-start on problem open" description="The timer starts as soon as a problem loads.">
        <Switch checked={timer.autoStart} onCheckedChange={(v) => setTimer({ autoStart: v })} aria-label="Auto-start timer" />
      </SettingRow>
      <SettingRow label="Show in toolbar">
        <Switch checked={timer.visible} onCheckedChange={(v) => setTimer({ visible: v })} aria-label="Show timer in toolbar" />
      </SettingRow>
    </div>
  );
}
