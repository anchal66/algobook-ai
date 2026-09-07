"use client";
/** Problem List drawer (Module 03 §1.10 / W-17): project items + Explore pool, search / sort / filter, solved ring, Ask-AI form. */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpDown, Check, Filter, Loader2, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listProblems } from "@/lib/workspace/api";
import { useWorkspace } from "@/store/workspace";
import type { ProblemSummaryDTO } from "@/lib/workspace/types";
import type { Difficulty } from "@/types";
import { useNextProblem } from "@/components/workspace/hooks/useNextProblem";
import { AskAiForm } from "@/components/workspace/Drawer/AskAiForm";
import { DIFFICULTY_TEXT } from "@/components/workspace/Description/ProblemHeader";

type Sort = "order" | "title" | "difficulty";
type StatusFilter = "all" | "todo" | "solved";
const DIFF_RANK: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };

interface Row { id: string; number: number | null; title: string; difficulty: Difficulty; tags: string[]; solved: boolean; order: number }

function SolvedRing({ solved, total }: { solved: number; total: number }) {
  const pct = total ? solved / total : 0;
  const r = 9, c = 2 * Math.PI * r;
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" /><circle cx="11" cy="11" r={r} fill="none" stroke="#2cbb5d" strokeWidth="2.5" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform="rotate(-90 11 11)" /></svg>
      {solved}/{total} Solved
    </span>
  );
}

export function ProblemListDrawer() {
  const open = useWorkspace((s) => s.drawerOpen);
  const setUi = useWorkspace((s) => s.setUi);
  const items = useWorkspace((s) => s.items);
  const project = useWorkspace((s) => s.project);
  const problem = useWorkspace((s) => s.problem);
  const nav = useNextProblem();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("order");
  const [diff, setDiff] = useState<Difficulty | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [topic, setTopic] = useState<string>("all");
  const [explore, setExplore] = useState<ProblemSummaryDTO[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || explore.length) return;
    setLoading(true);
    listProblems({ limit: 30 }).then((r) => { setExplore(r.items); setCursor(r.nextCursor); }).catch(() => undefined).finally(() => setLoading(false));
  }, [open, explore.length]);

  const more = async () => {
    if (!cursor) return;
    setLoading(true);
    try { const r = await listProblems({ limit: 30, cursor }); setExplore((x) => [...x, ...r.items]); setCursor(r.nextCursor); } finally { setLoading(false); }
  };

  const topics = useMemo(() => Array.from(new Set([...items.flatMap((i) => i.tags), ...explore.flatMap((p) => p.tags)])).sort(), [items, explore]);
  const filterRows = (rows: Row[]) => {
    const ql = q.trim().toLowerCase();
    const f = rows.filter((r) => (diff === "all" || r.difficulty === diff) && (status === "all" || (status === "solved") === r.solved) && (topic === "all" || r.tags.includes(topic)) && (!ql || r.title.toLowerCase().includes(ql) || String(r.number ?? "").includes(ql)));
    if (sort === "title") f.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "difficulty") f.sort((a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty]);
    else f.sort((a, b) => a.order - b.order);
    return f;
  };
  const projectRows = filterRows(items.map((i, k) => ({ id: i.problemId, number: k + 1, title: i.title, difficulty: i.difficulty, tags: i.tags, solved: i.status === "solved", order: i.order })));
  const projectIds = new Set(items.map((i) => i.problemId));
  const exploreRows = filterRows(explore.filter((p) => !projectIds.has(p.id)).map((p, k) => ({ id: p.id, number: p.number, title: p.title, difficulty: p.difficulty, tags: p.tags, solved: false, order: k })));
  const solved = items.filter((i) => i.status === "solved").length;

  const RowView = ({ r, index }: { r: Row; index: number }) => (
    <button
      type="button"
      onClick={() => { nav.goTo(r.id); setUi({ drawerOpen: false }); }}
      aria-current={problem?.id === r.id ? "page" : undefined}
      className={cn("flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-sm transition-colors hover:bg-ws-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60", index % 2 === 1 && "bg-fg-1/[0.03]", problem?.id === r.id && "bg-ws-chip")}
    >
      <span className="flex w-4 justify-center text-accepted">{r.solved && <Check className="size-4" />}</span>
      <span className="min-w-0 flex-1 truncate text-fg-1">{r.number ? `${r.number}. ` : ""}{r.title}</span>
      <span className={cn("shrink-0 text-xs", DIFFICULTY_TEXT[r.difficulty])}>{r.difficulty}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => setUi({ drawerOpen: o })}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 border-line bg-ws-panel p-0 text-fg-1 sm:max-w-[520px] [&>button]:hidden">
        <div className="flex items-center gap-3 border-b border-line/60 px-4 py-3">
          <SheetTitle className="text-base font-semibold text-fg-1">Problem List</SheetTitle>
          {project && <span className="truncate text-xs text-fg-3">› {project.title}</span>}
          <span className="ml-auto flex items-center gap-3">
            {project && <SolvedRing solved={solved} total={items.length} />}
            <button type="button" onClick={() => setUi({ drawerOpen: false })} aria-label="Close" className="flex size-7 items-center justify-center rounded-[6px] text-fg-3 hover:bg-ws-hover hover:text-fg-1"><X className="size-4" /></button>
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2">
          <label className="flex h-8 flex-1 items-center gap-2 rounded-[8px] bg-fg-1/[0.07] px-2.5 text-sm">
            <Search className="size-4 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions" className="w-full bg-transparent text-fg-1 outline-none placeholder:text-fg-3" />
          </label>
          <button type="button" onClick={() => setSort((s) => (s === "order" ? "title" : s === "title" ? "difficulty" : "order"))} aria-label={`Sort: ${sort}`} title={`Sort: ${sort}`} className="flex size-8 items-center justify-center rounded-[8px] bg-fg-1/[0.07] text-fg-2 hover:text-fg-1">
            {sort === "title" ? <ArrowDownAZ className="size-4" /> : <ArrowUpDown className="size-4" />}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Filter" className={cn("flex size-8 items-center justify-center rounded-[8px] bg-fg-1/[0.07] hover:text-fg-1", diff !== "all" || status !== "all" || topic !== "all" ? "text-brand-to" : "text-fg-2")}><Filter className="size-4" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div>
                <p className="mb-1 text-xs text-fg-3">Difficulty</p>
                <div className="flex gap-1">{(["all", "Easy", "Medium", "Hard"] as const).map((d) => <button key={d} type="button" onClick={() => setDiff(d)} className={cn("h-7 rounded-full px-2.5 text-xs", diff === d ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:bg-ws-hover")}>{d === "all" ? "All" : d}</button>)}</div>
              </div>
              <div>
                <p className="mb-1 text-xs text-fg-3">Status</p>
                <div className="flex gap-1">{(["all", "todo", "solved"] as const).map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("h-7 rounded-full px-2.5 text-xs capitalize", status === s ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:bg-ws-hover")}>{s}</button>)}</div>
              </div>
              <div>
                <p className="mb-1 text-xs text-fg-3">Topic</p>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="h-8 w-full rounded-[8px] border border-line bg-bg-2 px-2 text-sm text-fg-1">
                  <option value="all">All topics</option>
                  {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="ws-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {project && (
            <section aria-label="This project">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-3">This project</p>
              {projectRows.length ? projectRows.map((r, i) => <RowView key={r.id} r={r} index={i} />) : <p className="px-3 py-2 text-xs text-fg-3">{items.length ? "No problems match." : "No problems yet — generate one below."}</p>}
            </section>
          )}
          <section aria-label="Explore">
            <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-3">Explore</p>
            {exploreRows.map((r, i) => <RowView key={r.id} r={r} index={i} />)}
            {loading && <div className="flex justify-center py-3"><Loader2 className="size-4 animate-spin text-fg-3" /></div>}
            {!loading && cursor && <button type="button" onClick={() => void more()} className="mx-3 my-2 h-8 rounded-[6px] bg-ws-chip px-3 text-xs text-fg-1 hover:bg-ws-hover">Load more</button>}
            {!loading && !exploreRows.length && !cursor && <p className="px-3 py-2 text-xs text-fg-3">Nothing else to explore yet.</p>}
          </section>
        </div>
        {nav.hasProject && <div className="border-t border-line/60 p-4"><AskAiForm /></div>}
      </SheetContent>
    </Sheet>
  );
}
