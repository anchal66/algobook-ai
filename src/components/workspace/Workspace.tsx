"use client";
/**
 * Workspace root (Module 03 W-03/W-04/W-22/W-26): providers, shortcuts, fullscreen, panel slots.
 * Rendered only on the client (see WorkspaceClient) so persisted layout/settings are read before first paint.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { BookOpen, CheckSquare, FileText, FlaskConical, History, NotebookPen, Play, ScanEye, Sparkles, SquareCode } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWorkspace, type LeftTab } from "@/store/workspace";
import { useSettings } from "@/store/settings";
import { useProblemLoader } from "@/components/workspace/hooks/useProblemLoader";
import { useAutosave } from "@/components/workspace/hooks/useAutosave";
import { useRunSubmit } from "@/components/workspace/hooks/useRunSubmit";
import { useVisualize } from "@/components/workspace/hooks/useVisualize";
import { useNextProblem } from "@/components/workspace/hooks/useNextProblem";
import { useShortcuts } from "@/components/workspace/hooks/useShortcuts";
import { useMediaQuery } from "@/components/workspace/hooks/useMediaQuery";
import { TopBar } from "@/components/workspace/TopBar/TopBar";
import { WorkspaceLayout } from "@/components/workspace/Layout/WorkspaceLayout";
import { getPanel } from "@/components/workspace/Layout/layoutRegistry";
import type { PanelSlot } from "@/components/workspace/Layout/PanelCard";
import { DescriptionTab } from "@/components/workspace/Description/DescriptionTab";
import { EditorialTab } from "@/components/workspace/Editorial/EditorialTab";
import { SolutionsTab } from "@/components/workspace/Solutions/SolutionsTab";
import { SubmissionsTab } from "@/components/workspace/Submissions/SubmissionsTab";
import { CodeBody, CodeHeaderActions, CodeHeaderExtra, formatCurrentCode } from "@/components/workspace/Code/CodePanel";
import { focusEditor } from "@/components/workspace/Code/editorRef";
import { TestcaseTab } from "@/components/workspace/Console/TestcaseTab";
import { TestResultTab } from "@/components/workspace/Console/TestResultTab";
import { TraceTab } from "@/components/workspace/Trace/TraceTab";
import { useTrace } from "@/store/trace";
import { NotesPanel } from "@/components/workspace/Side/NotesPanel";
import { TutorChatPanel } from "@/components/workspace/Side/TutorChatPanel";
import { ProblemListDrawer } from "@/components/workspace/Drawer/ProblemListDrawer";
import { SettingsDialog } from "@/components/workspace/Settings/SettingsDialog";
import { PanelErrorBoundary } from "@/components/workspace/Overlays/PanelErrorBoundary";
import { MobileLayout } from "@/components/workspace/MobileLayout";
import { useRouter } from "next/navigation";
import { ShieldAlert, Trophy } from "lucide-react";
import { RoomTopBar } from "@/components/rooms/RoomTopBar";
import { IntegrityPanel, LeaderboardPanel } from "@/components/rooms/RoomSidePanels";
import { ConsentDialog } from "@/components/rooms/ConsentDialog";
import { useIntegrityMonitor } from "@/components/rooms/useIntegrityMonitor";
import { rooms as roomsApi } from "@/lib/app/api";
import { useRoom, serverNow } from "@/store/room";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface WorkspaceProps { problemId: string | null; projectId: string | null; /** Module 06: contest arena */ room?: { id: string; index: number } | null }

export function Workspace({ problemId, projectId, room = null }: WorkspaceProps) {
  useProblemLoader(problemId, projectId, room);
  const roomDetail = useRoom((s) => s.detail);
  const loadRoom = useRoom((s) => s.load);
  const router = useRouter();
  const [consentBusy, setConsentBusy] = useState(false);
  // Module 06: keep the room polled while the arena is open; leave when the contest is over.
  useEffect(() => {
    if (!room) return;
    void loadRoom(room.id);
    return () => { useRoom.getState().stop(); };
  }, [room?.id, loadRoom]); // eslint-disable-line react-hooks/exhaustive-deps
  const roomStatus = roomDetail?.room.status;
  useEffect(() => {
    if (!room || !roomStatus) return;
    if (roomStatus === "finished" || roomStatus === "finalising" || roomStatus === "cancelled") { toast("The contest is over — here are the results."); router.replace(`/rooms/${room.id}`); }
    if (roomStatus === "lobby") router.replace(`/rooms/${room.id}`);
  }, [room, roomStatus, router]);
  const roomSettings = roomDetail?.room.settings;
  const consented = !!roomDetail?.me?.consented;
  useIntegrityMonitor({ roomId: room?.id ?? "", enabled: !!room && consented && roomStatus === "running", blockPaste: roomSettings?.integrity.blockPaste ?? true, blockCopy: roomSettings?.integrity.blockCopy ?? true, requireFullscreen: roomSettings?.integrity.requireFullscreen ?? false });
  const acceptConsent = useCallback(async () => {
    if (!room) return;
    setConsentBusy(true);
    try { await roomsApi.consent(room.id); await loadRoom(room.id, true); if (roomSettings?.integrity.requireFullscreen) { try { await document.documentElement.requestFullscreen?.(); } catch { /* denied */ } } }
    catch (e) { toast.error((e as Error)?.message ?? "Could not record your consent"); }
    finally { setConsentBusy(false); }
  }, [room, loadRoom, roomSettings]);
  const declineConsent = useCallback(async () => {
    if (!room) return;
    try { await roomsApi.leave(room.id); } catch { /* ignore */ }
    router.replace(`/rooms/${room.id}`);
  }, [room, router]);
  const { onChange } = useAutosave();
  const { run, submit } = useRunSubmit();
  const { visualize } = useVisualize();
  const nav = useNextProblem();
  const { setTheme } = useTheme();
  const themePref = useSettings((s) => s.editor.theme);
  const leftTab = useWorkspace((s) => s.leftTab);
  const consoleTab = useWorkspace((s) => s.consoleTab);
  const sidePanel = useWorkspace((s) => s.sidePanel);
  const fullscreen = useWorkspace((s) => s.fullscreen);
  const maximized = useWorkspace((s) => s.maximized);
  const setUi = useWorkspace((s) => s.setUi);
  const generation = useWorkspace((s) => s.generation);
  const [tutorPrompt, setTutorPrompt] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  // Workspace theme preference drives next-themes while the workspace is open.
  useEffect(() => { setTheme(themePref); }, [themePref, setTheme]);

  // Leaving the workspace (root unmount only — the hook is shared by the drawer and the Ask-AI form, which mount and unmount freely)
  // stops waiting on a running generation; the server still finishes and links the problem to the project.
  useEffect(() => () => { nav.cancelGeneration(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "/solve/next": nothing queued → stream the next problem. Wait until the loader has put the project into the store
  // (auth may still be resolving on the first render); depending on the route prop alone fired once, too early, and never retried.
  const storeProjectId = useWorkspace((s) => s.projectId);
  const storeLoading = useWorkspace((s) => s.loading);
  useEffect(() => {
    if (!problemId && projectId && storeProjectId === projectId && !storeLoading && !generation.active && !generation.error && generation.stages.length === 0) void nav.generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, projectId, storeProjectId, storeLoading]);

  const toggleFullscreen = useCallback(() => {
    const next = !useWorkspace.getState().fullscreen;
    setUi({ fullscreen: next });
    try { if (next) void document.documentElement.requestFullscreen?.(); else if (document.fullscreenElement) void document.exitFullscreen(); } catch { /* unsupported */ }
  }, [setUi]);
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement && useWorkspace.getState().fullscreen) setUi({ fullscreen: false }); };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [setUi]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && useWorkspace.getState().fullscreen) toggleFullscreen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const togglePanel = useCallback((id: string) => { const p = getPanel(id); if (!p) return; if (p.isCollapsed()) p.expand(); else p.collapse(); }, []);

  // A new problem invalidates the previous trace.
  const problemKey = useWorkspace((s) => s.problem?.id ?? null);
  useEffect(() => { useTrace.getState().reset(); }, [problemKey]);

  useShortcuts({
    run: () => void run(),
    submit: () => void submit(),
    debugStart: () => void visualize(),
    fullscreen: toggleFullscreen,
    maximizePanel: () => setUi({ maximized: maximized ? null : "code" }),
    closeTab: () => { if (sidePanel) setUi({ sidePanel: null }); else if (maximized) setUi({ maximized: null }); },
    format: formatCurrentCode,
    nextProblem: () => { if (nav.canNext) nav.goNext(); },
    prevProblem: () => { if (nav.canPrev) nav.goPrev(); },
    toggleDescription: () => togglePanel("left"),
    toggleConsole: () => togglePanel("console"),
    focusEditor,
    commandPalette: () => setUi({ drawerOpen: true }),
  });

  const askTutor = useCallback(() => {
    const r = useWorkspace.getState().submitResult?.submission;
    setTutorPrompt(r ? `My submission got ${r.verdict} (${r.passed}/${r.total} passed). Help me find what is wrong without giving the full solution.` : null);
    setUi({ sidePanel: "tutor" });
  }, [setUi]);
  const viewEditorial = useCallback(() => setUi({ leftTab: "editorial" }), [setUi]);

  const leftSlot = useMemo<PanelSlot>(() => ({
    id: "left",
    tabs: room ? [{ id: "description", label: "Description", icon: <FileText />, iconClass: "text-[#1a90ff]" }] : [
      { id: "description", label: "Description", icon: <FileText />, iconClass: "text-[#1a90ff]" },
      { id: "editorial", label: "Editorial", icon: <BookOpen />, iconClass: "text-[#ffa116]" },
      { id: "solutions", label: "Solutions", icon: <FlaskConical />, iconClass: "text-[#1a90ff]" },
      { id: "submissions", label: "Submissions", icon: <History />, iconClass: "text-accepted" },
    ],
    activeTab: leftTab,
    onTabChange: (id) => setUi({ leftTab: id as LeftTab }),
    minSize: "240px",
    children: (
      <PanelErrorBoundary name="Description">
        {leftTab === "description" && <DescriptionTab />}
        {leftTab === "editorial" && <EditorialTab />}
        {leftTab === "solutions" && <SolutionsTab onLoadCode={onChange} />}
        {leftTab === "submissions" && <SubmissionsTab onLoadCode={onChange} />}
      </PanelErrorBoundary>
    ),
  }), [leftTab, setUi, onChange, room]);

  const codeSlot = useMemo<PanelSlot>(() => ({
    id: "code",
    tabs: [{ id: "code", label: "Code", icon: <SquareCode />, iconClass: "text-accepted" }],
    activeTab: "code",
    extra: <CodeHeaderExtra />,
    actions: <CodeHeaderActions onRun={() => void run()} onSubmit={() => void submit()} onVisualize={() => void visualize()} onChange={onChange} />,
    keepMounted: true,
    minSize: "120px",
    children: <PanelErrorBoundary name="Code"><CodeBody onChange={onChange} /></PanelErrorBoundary>,
  }), [run, submit, visualize, onChange]);

  const consoleSlot = useMemo<PanelSlot>(() => ({
    id: "console",
    tabs: [
      { id: "testcase", label: "Testcase", icon: <CheckSquare />, iconClass: "text-accepted" },
      { id: "result", label: "Test Result", icon: <Play />, iconClass: "text-accepted" },
      { id: "trace", label: "Visualize", icon: <ScanEye />, iconClass: "text-brand-to" },
    ],
    activeTab: consoleTab,
    onTabChange: (id) => setUi({ consoleTab: id as "testcase" | "result" | "trace" }),
    minSize: "100px",
    children: (
      <PanelErrorBoundary name="Console">
        {consoleTab === "testcase" ? <TestcaseTab /> : consoleTab === "trace" ? <TraceTab /> : <TestResultTab onNext={nav.goNext} onViewEditorial={viewEditorial} onAskTutor={askTutor} />}
      </PanelErrorBoundary>
    ),
  }), [consoleTab, setUi, nav.goNext, viewEditorial, askTutor]);

  const sideSlot = useMemo<PanelSlot | null>(() => sidePanel ? ({
    id: "side",
    tabs: sidePanel === "notes" ? [{ id: "notes", label: "Notes", icon: <NotebookPen />, iconClass: "text-[#ffa116]" }]
      : sidePanel === "leaderboard" ? [{ id: "leaderboard", label: "Leaderboard", icon: <Trophy />, iconClass: "text-medium" }]
      : sidePanel === "integrity" ? [{ id: "integrity", label: "Integrity", icon: <ShieldAlert />, iconClass: "text-wrong" }]
      : [{ id: "tutor", label: "AI Tutor", icon: <Sparkles />, iconClass: "text-brand-to" }],
    activeTab: sidePanel,
    minSize: "260px",
    children: <PanelErrorBoundary name={sidePanel}>{sidePanel === "notes" ? <NotesPanel /> : sidePanel === "leaderboard" ? <LeaderboardPanel /> : sidePanel === "integrity" ? <IntegrityPanel /> : <TutorChatPanel initialPrompt={tutorPrompt} />}</PanelErrorBoundary>,
  }) : null, [sidePanel, tutorPrompt]);

  return (
    <TooltipProvider delayDuration={300}>
      <main className={cn("ws-root flex h-dvh w-full flex-col overflow-hidden bg-ws-page text-fg-1", fullscreen && "fixed inset-0 z-40")}>
        {!fullscreen && (room
          ? <RoomTopBar roomId={room.id} index={room.index} onRun={() => void run()} onSubmit={() => void submit()} onVisualize={() => void visualize()} onFullscreen={toggleFullscreen} />
          : <TopBar nav={nav} onRun={() => void run()} onSubmit={() => void submit()} onVisualize={() => void visualize()} onFullscreen={toggleFullscreen} />)}
        <div className={cn("min-h-0 flex-1", fullscreen ? "p-2" : "px-2.5 pb-2.5 lg:px-[10px] lg:pb-[10px]")}>
          {isMobile ? (
            <MobileLayout left={leftSlot} code={codeSlot} console={consoleSlot} side={sideSlot} onRun={() => void run()} onSubmit={() => void submit()} />
          ) : (
            <WorkspaceLayout left={leftSlot} code={codeSlot} console={consoleSlot} side={sideSlot} />
          )}
        </div>
        {!room && <ProblemListDrawer />}
        {room && roomDetail && roomStatus === "running" && (
          <ConsentDialog open={!consented} roomName={roomDetail.room.name} summary={roomDetail.room.summary} rules={roomDetail.room.rules} onAccept={() => void acceptConsent()} onDecline={() => void declineConsent()} busy={consentBusy} />
        )}
        {room && roomDetail && roomStatus === "running" && roomDetail.room.startedAt && Date.parse(roomDetail.room.startedAt) > serverNow() && (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/60"><div className="rounded-[16px] bg-ws-panel px-10 py-8 text-center"><p className="text-sm text-fg-2">Get ready</p><p className="font-mono text-6xl font-semibold text-fg-1 tabular-nums">{Math.max(0, Math.ceil((Date.parse(roomDetail.room.startedAt) - serverNow()) / 1000))}</p></div></div>
        )}
        <SettingsDialog />
        <Toaster position="bottom-right" theme={themePref === "system" ? "system" : themePref} closeButton toastOptions={{ className: "!bg-ws-panel !text-fg-1 !border-line" }} />
      </main>
    </TooltipProvider>
  );
}
