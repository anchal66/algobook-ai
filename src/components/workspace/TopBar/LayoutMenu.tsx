"use client";
/** ⊞ Layout menu: reset layout, run/submit placement, full screen (Module 03 §1.1). */
import { Expand, LayoutGrid, RotateCcw, Shrink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { comboLabel, shortcutById } from "@/lib/editor/shortcuts";
import { resetPanelLayout } from "@/components/workspace/Layout/layoutRegistry";
import { useSettings } from "@/store/settings";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";

export const iconBtn = "flex size-8 items-center justify-center rounded-[8px] text-fg-2 transition-colors duration-150 hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60";

export function LayoutMenu({ onFullscreen }: { onFullscreen: () => void }) {
  const resetLayout = useSettings((s) => s.resetLayout);
  const placement = useSettings((s) => s.layout.runSubmitPlacement);
  const setLayout = useSettings((s) => s.setLayout);
  const fullscreen = useWorkspace((s) => s.fullscreen);
  const setUi = useWorkspace((s) => s.setUi);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Layout" className={iconBtn}>
              <LayoutGrid className="size-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Layout</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60 border-line bg-ws-panel text-fg-1">
        <DropdownMenuLabel className="text-xs text-fg-3">Dynamic layout</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => { resetLayout(); resetPanelLayout(); setUi({ maximized: null }); }}>
          <RotateCcw className="size-4" /> Reset to default layout
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onFullscreen}>
          {fullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
          {fullscreen ? "Exit full screen" : "Enter full screen"}
          <span className="ml-auto text-xs text-fg-3">{comboLabel(shortcutById("fullscreen").combo)}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-fg-3">Show Run / Submit buttons in</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setLayout({ runSubmitPlacement: "toolbar" })} className={cn(placement === "toolbar" && "text-brand-from")}>Toolbar</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setLayout({ runSubmitPlacement: "editor" })} className={cn(placement === "editor" && "text-brand-from")}>Code editor</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
