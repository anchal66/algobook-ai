"use client";
/** Project overview (Module 05 U-15): header + Solve · Plan · Problems · Activity · Settings. Replaces the v1 insights/history pages. */
import { Suspense, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/lib/app/query";
import { ApiError, getProject } from "@/lib/app/api";
import { errorText } from "@/lib/app/errors";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ActivityTab, PlanTab, ProblemsTab, SettingsTab } from "@/components/project/tabs";
import { COMPANY_LABEL } from "@/components/dashboard/ProjectCard";
import { titleCase } from "@/lib/app/format";
import { useNow } from "@/lib/app/useNow";

const TABS = ["plan", "problems", "activity", "settings"] as const;
type Tab = (typeof TABS)[number];

function Overview({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as Tab) : "plan";
  const now = useNow();
  const q = useQuery(user ? `/api/projects/${projectId}` : null, () => getProject(projectId), { staleMs: 30_000 });
  const project = q.data?.project;
  const items = q.data?.items ?? [];
  const nextItem = items.find((i) => i.status !== "solved");
  const solveHref = nextItem ? `/project/${projectId}/solve/${nextItem.problemId}` : `/project/${projectId}/solve/next`;

  if (q.loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (q.error || !project) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    const notFound = !q.error || status === 404 || status === 403;
    return <EmptyState title={notFound ? "Project not found" : "Couldn't load this project"} description={notFound ? "It may have been deleted." : errorText(q.error)} action={<>{!notFound && <Button variant="brand" onClick={() => void q.refetch()}>Retry</Button>}<Button asChild variant="outline"><Link href="/projects">All projects</Link></Button></>} />;
  }

  const pr = project.progress;
  const pct = pr.items ? Math.round((pr.solved / pr.items) * 100) : 0;
  const elapsed = Math.max(0, Math.floor((now - new Date(project.createdAt).getTime()) / 86_400_000));
  const dayPct = Math.min(100, Math.round((elapsed / Math.max(1, project.durationDays)) * 100));
  const company = project.templateId ? COMPANY_LABEL[project.templateId] ?? titleCase(project.templateId) : null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-3"><Link href="/projects" className="hover:text-text-1">Projects</Link><span>/</span><span>{project.title}</span></div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-text-1">{project.title}{company && <Badge variant="brand"><Building2 />{company}</Badge>}{pr.items > 0 && <Badge variant={pr.onTrack ? "ok" : "warn"}>{pr.onTrack ? "On track" : "Behind pace"}</Badge>}</h1>
          {project.purpose && <p className="mt-1 text-sm text-text-2">{project.purpose}</p>}
          <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
            <div><div className="flex justify-between text-xs text-text-3"><span>Problems</span><span className="tabular"><span className="font-medium text-text-1">{pr.solved}</span>/{pr.items} · {pct}%</span></div><Progress value={pct} className="mt-1 h-1.5" /></div>
            <div><div className="flex justify-between text-xs text-text-3"><span className="flex items-center gap-1"><CalendarDays className="size-3.5" />Day {Math.min(elapsed + 1, project.durationDays)} of {project.durationDays}</span><span className="tabular">{Math.max(0, project.durationDays - elapsed)}d left</span></div><Progress value={dayPct} className="mt-1 h-1.5" indicatorClassName="bg-text-3" /></div>
          </div>
        </div>
        <Button asChild variant="brand" size="lg" className="shrink-0"><Link href={solveHref}><Play className="size-4" /> {nextItem ? `Solve: ${nextItem.title}` : pr.items ? "Get next problem" : "Start solving"}</Link></Button>
      </div>
      <Tabs value={tab} onValueChange={(v) => router.replace(`/project/${projectId}?tab=${v}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="problems">Problems <Badge size="sm" className="ml-1">{items.length}</Badge></TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="plan"><PlanTab project={project} /></TabsContent>
        <TabsContent value="problems"><ProblemsTab project={project} items={items} /></TabsContent>
        <TabsContent value="activity"><ActivityTab project={project} /></TabsContent>
        <TabsContent value="settings"><SettingsTab project={project} /></TabsContent>
      </Tabs>
    </>
  );
}

export default function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-96" />}><Overview projectId={projectId} /></Suspense>
    </AppShell>
  );
}
