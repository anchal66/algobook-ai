"use client";
/** Settings → Dynamic Layout (Module 03 §1.9): reset, Run/Submit placement with thumbnails. */
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings, type RunSubmitPlacement } from "@/store/settings";
import { useWorkspace } from "@/store/workspace";
import { resetPanelLayout } from "@/components/workspace/Layout/layoutRegistry";
import { SettingRow } from "@/components/workspace/Settings/SettingRow";

function Thumb({ placement, active, onClick }: { placement: RunSubmitPlacement; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("w-36 rounded-[8px] border p-2 text-left transition-colors", active ? "border-brand-from bg-brand-from/10" : "border-line hover:bg-ws-hover")}>
      <div className="rounded-[4px] bg-bg-2 p-1">
        <div className="mb-1 flex h-2 items-center justify-center gap-0.5 rounded-sm bg-bg-3">
          {placement === "toolbar" && <><span className="h-1 w-2 rounded-sm bg-fg-2" /><span className="h-1 w-2 rounded-sm bg-accepted" /></>}
        </div>
        <div className="flex gap-1">
          <div className="h-10 flex-1 rounded-sm bg-bg-3" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex h-6 items-start justify-end gap-0.5 rounded-sm bg-bg-3 p-0.5">
              {placement === "editor" && <><span className="h-1 w-2 rounded-sm bg-fg-2" /><span className="h-1 w-2 rounded-sm bg-accepted" /></>}
            </div>
            <div className="h-3 rounded-sm bg-bg-3" />
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-xs font-medium text-fg-1">{placement === "toolbar" ? "Toolbar" : "Code Editor"}</p>
    </button>
  );
}

export function DynamicLayoutSettings() {
  const placement = useSettings((s) => s.layout.runSubmitPlacement);
  const setLayout = useSettings((s) => s.setLayout);
  const resetLayout = useSettings((s) => s.resetLayout);
  const setUi = useWorkspace((s) => s.setUi);
  return (
    <div className="divide-y divide-line/60">
      <SettingRow label="Default layout" description="Restore the 50/50 and 65/35 splits and expand every panel.">
        <button type="button" onClick={() => { resetLayout(); resetPanelLayout(); setUi({ maximized: null }); }} className="flex h-8 items-center gap-1.5 rounded-[8px] bg-ws-chip px-3 text-xs font-medium text-fg-1 hover:bg-ws-hover"><RotateCcw className="size-3.5" /> Reset</button>
      </SettingRow>
      <div className="py-3">
        <p className="text-sm font-medium text-fg-1">Show Run / Submit / Debug buttons in</p>
        <div className="mt-2 flex gap-3">
          <Thumb placement="toolbar" active={placement === "toolbar"} onClick={() => setLayout({ runSubmitPlacement: "toolbar" })} />
          <Thumb placement="editor" active={placement === "editor"} onClick={() => setLayout({ runSubmitPlacement: "editor" })} />
        </div>
      </div>
    </div>
  );
}
