"use client";
/** Project card (Module 05 U-12/U-15): progress ring, on-track pill, template badge, menu. Shared by /dashboard and /projects. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarDays, MoreHorizontal, Play, Trash2, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatRing } from "@/components/charts";
import { deleteProject, type ProjectDTO } from "@/lib/app/api";
import { invalidate } from "@/lib/app/query";
import { timeAgo, titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/app/useNow";

export const COMPANY_LABEL: Record<string, string> = { amazon: "Amazon", apple: "Apple", google: "Google", meta: "Meta", microsoft: "Microsoft", uber: "Uber" };

export function isSystemProject(p: ProjectDTO): boolean {
  return p.purpose.startsWith("system:") || p.purpose === "daily" || p.purpose === "interview";
}

export function ProjectCard({ project, className }: { project: ProjectDTO; className?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const pr = project.progress;
  const pct = pr.items ? Math.round((pr.solved / pr.items) * 100) : 0;
  const elapsedDays = Math.max(0, Math.floor((now - new Date(project.createdAt).getTime()) / 86_400_000));
  const daysLeft = Math.max(0, project.durationDays - elapsedDays);
  const company = project.templateId ? COMPANY_LABEL[project.templateId] ?? titleCase(project.templateId) : null;

  const remove = async () => {
    setBusy(true);
    try {
      await deleteProject(project.id);
      toast.success(`Deleted “${project.title}”`);
      invalidate("/api/projects");
      setConfirm(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card variant="glow" className={cn("group relative flex h-full flex-col p-5", className)}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {company && <Badge variant="brand" size="sm"><Building2 />{company}</Badge>}
              {pr.items > 0 && (
                <Badge variant={pr.onTrack ? "ok" : "warn"} size="sm">{pr.onTrack ? "On track" : "Behind pace"}</Badge>
              )}
            </div>
            <Link href={`/project/${project.id}`} className="mt-2 block truncate text-md font-semibold text-text-1 hover:underline underline-offset-4">{project.title}</Link>
            {project.purpose && <p className="mt-0.5 line-clamp-2 text-sm text-text-2">{project.purpose}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Project actions" className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-text-3 opacity-70 transition-opacity hover:bg-surface-2 hover:text-text-1 group-hover:opacity-100 focus-visible:opacity-100">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-[12px] border-line bg-popover p-1.5">
              <DropdownMenuItem onClick={() => router.push(`/project/${project.id}/solve/next`)} className="gap-2 rounded-[8px]"><Play className="size-4 text-text-3" /> Solve next</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/project/${project.id}?tab=plan`)} className="gap-2 rounded-[8px]"><BarChart3 className="size-4 text-text-3" /> Plan &amp; insights</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-line" />
              <DropdownMenuItem onClick={() => setConfirm(true)} className="gap-2 rounded-[8px] text-err focus:text-err"><Trash2 className="size-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <StatRing solved={{ Easy: pr.easy, Medium: pr.medium, Hard: pr.hard }} totals={pr.items ? undefined : undefined} size={72} stroke={7} legend={false} centerLabel={pr.items ? `of ${pr.items}` : "solved"} />
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-text-2">Progress</span>
              <span className="tabular font-semibold text-text-1">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-brand transition-[width] duration-600 ease-out-quart" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-3">
              <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{daysLeft > 0 ? `${daysLeft}d left` : "Ended"}</span>
              <span>{pr.activeDays} active day{pr.activeDays === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-xs text-text-3">{project.lastActivityAt ? `Active ${timeAgo(project.lastActivityAt)}` : `Created ${timeAgo(project.createdAt)}`}</span>
          <Button asChild size="sm" variant="secondary"><Link href={`/project/${project.id}`}>Open</Link></Button>
        </div>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="rounded-modal border-line bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{project.title}”?</DialogTitle>
            <DialogDescription>This removes the project, its problem list, notes and submissions for this project. Your global stats, rating and streak are unaffected. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" loading={busy} onClick={() => void remove()}>Delete project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewProjectTile({ className }: { className?: string }) {
  return (
    <Link href="/projects/new" className={cn("group flex min-h-[220px] flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-transparent p-5 text-center transition-colors hover:border-brand hover:bg-brand-soft/40", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-110"><Play className="size-5" /></span>
      <span className="mt-3 text-md font-semibold text-text-1">New project</span>
      <span className="mt-1 text-sm text-text-2">Company template or custom goal</span>
    </Link>
  );
}
