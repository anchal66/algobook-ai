"use client";
/** All projects (Module 05 nav rail entry). */
import Link from "next/link";
import { useMemo, useState } from "react";
import { FolderKanban, Plus, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { useQuery } from "@/lib/app/query";
import { listProjects } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewProjectTile, ProjectCard, isSystemProject } from "@/components/dashboard/ProjectCard";

export default function ProjectsPage() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const projects = useQuery(user ? "/api/projects" : null, listProjects);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");
  const dailyId = me?.user.dailyProjectId ?? null;
  const list = projects.data?.projects;

  const rows = useMemo(() => {
    const all = (list ?? []).filter((p) => !isSystemProject(p) && p.id !== dailyId);
    const s = q.trim().toLowerCase();
    return all.filter((p) => {
      const done = p.progress.items > 0 && p.progress.solved >= p.progress.items;
      if (filter === "active" && done) return false;
      if (filter === "done" && !done) return false;
      return !s || p.title.toLowerCase().includes(s) || p.purpose.toLowerCase().includes(s) || (p.templateId ?? "").includes(s);
    });
  }, [list, q, filter, dailyId]);

  return (
    <>
      <PageHeader title="Projects" description="Each project is a goal with its own problem list, plan and insights." actions={<Button asChild variant="brand"><Link href="/projects/new"><Plus className="size-4" /> New project</Link></Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="pl-9" aria-label="Search projects" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} variant="pill"><TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="done">Completed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      </div>
      {projects.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : rows.length === 0 && !q ? (
        <EmptyState icon={<FolderKanban />} title={filter === "done" ? "No completed projects yet" : "No projects yet"} description="Create your first project to start practicing with AI-verified problems planned around your goal." action={<Button asChild variant="brand"><Link href="/projects/new">Create a project</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => <ProjectCard key={p.id} project={p} />)}
          <NewProjectTile />
        </div>
      )}
    </>
  );
}
