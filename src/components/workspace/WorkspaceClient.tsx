"use client";
/** Client-only entry: the workspace reads persisted layout/settings from localStorage before its first paint (W-31). */
import dynamic from "next/dynamic";
import type { WorkspaceProps } from "@/components/workspace/Workspace";

function Shell() {
  return (
    <div className="ws-root flex h-dvh w-full flex-col bg-ws-page" aria-busy="true" aria-label="Loading workspace">
      <div className="h-12 shrink-0" />
      <div className="flex min-h-0 flex-1 gap-2 px-[10px] pb-[10px]">
        <div className="flex-1 rounded-[8px] bg-ws-panel" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex-[65] rounded-[8px] bg-ws-panel" />
          <div className="flex-[35] rounded-[8px] bg-ws-panel" />
        </div>
      </div>
    </div>
  );
}

const Workspace = dynamic(() => import("@/components/workspace/Workspace").then((m) => m.Workspace), { ssr: false, loading: () => <Shell /> });

export function WorkspaceClient(props: WorkspaceProps) {
  return <Workspace {...props} />;
}
