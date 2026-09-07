"use client";
/** Profile building blocks (Module 05 U-16): identity card, badges grid, skills groups, recent AC. */
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownWideNarrow, Award, Binary, BookOpen, Brackets, Building2, CalendarCheck, CornerDownRight, Crown, Flame, GitBranch, GitFork, GraduationCap, Grid3x3, Hash, Languages, Layers, Leaf, Link as LinkIcon, Link2, ListOrdered, Lock, MapPin, Medal, Moon, Mountain, MoveHorizontal, Network, PanelLeftOpen, Pencil, Repeat, Rocket, Search, Share2, ShieldCheck, Sigma, Skull, Sparkles, Star, Table, Target, TextCursorInput, TrendingUp, Trophy, Type, Undo2, Waves, Zap, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AchievementsResponse, SkillTopic } from "@/lib/app/api";
import { fmtDate, titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

export interface ProfileIdentity {
  username: string; displayName: string; photoURL: string; bio: string; company: string; college: string; location: string;
  githubUrl: string; linkedinUrl: string; skills: string[]; createdAt: string; practiceState?: string;
}

const ICONS: Record<string, LucideIcon> = { Link: LinkIcon, ArrowDownWideNarrow, Award, Binary, BookOpen, Brackets, Building2, CalendarCheck, CornerDownRight, Crown, Flame, GitBranch, GitFork, GraduationCap, Grid3x3, Hash, Languages, Layers, Leaf, ListOrdered, Medal, Moon, Mountain, MoveHorizontal, Network, PanelLeftOpen, Repeat, Rocket, Search, Share2, ShieldCheck, Sigma, Skull, Sparkles, Star, Table, Target, TextCursorInput, TrendingUp, Trophy, Type, Undo2, Waves, Zap };

export function IdentityCard({ p, isOwner, rank }: { p: ProfileIdentity; isOwner: boolean; rank?: { rank: number | null; total: number } | null }) {
  const share = async () => {
    const url = `${window.location.origin}/${p.username}`;
    try { await navigator.clipboard.writeText(url); toast.success("Profile link copied"); } catch { toast.message(url); }
  };
  const host = (u: string) => { try { return new URL(u).hostname.replace("www.", ""); } catch { return u; } };
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <UserAvatar src={p.photoURL} name={p.displayName} size={72} className="ring-2 ring-line" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-text-1">{p.displayName || p.username}</h1>
          <p className="truncate text-sm text-text-3">@{p.username}</p>
          {rank && <p className="mt-1 text-sm text-text-2">Rank <span className="font-semibold tabular text-text-1">{rank.rank ? rank.rank.toLocaleString() : "—"}</span>{rank.total ? <span className="text-text-3"> / {rank.total.toLocaleString()}</span> : null}</p>}
        </div>
      </div>
      {p.bio ? <p className="mt-4 text-sm text-text-2">{p.bio}</p> : isOwner ? <p className="mt-4 text-sm text-text-3">Add a bio, your company and links so recruiters can find you.</p> : null}
      <ul className="mt-4 space-y-1.5 text-sm text-text-2">
        {p.company && <li className="flex items-center gap-2"><Building2 className="size-4 text-text-3" />{p.company}</li>}
        {p.college && <li className="flex items-center gap-2"><GraduationCap className="size-4 text-text-3" />{p.college}</li>}
        {p.location && <li className="flex items-center gap-2"><MapPin className="size-4 text-text-3" />{p.location}</li>}
        {p.githubUrl && <li className="flex items-center gap-2"><GithubMark className="size-4 text-text-3" /><a href={p.githubUrl} target="_blank" rel="noreferrer" className="truncate hover:text-text-1 hover:underline">{host(p.githubUrl)}{new URL(p.githubUrl).pathname}</a></li>}
        {p.linkedinUrl && <li className="flex items-center gap-2"><LinkedinMark className="size-4 text-text-3" /><a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="truncate hover:text-text-1 hover:underline">{host(p.linkedinUrl)}</a></li>}
        <li className="flex items-center gap-2 text-text-3"><Link2 className="size-4" />Joined {fmtDate(p.createdAt, { month: "short", year: "numeric" })}</li>
      </ul>
      {p.skills.length > 0 && (
        <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-text-3">Skills</p><div className="mt-2 flex flex-wrap gap-1.5">{p.skills.map((s) => <Badge key={s}>{s}</Badge>)}</div></div>
      )}
      <div className="mt-5 flex gap-2">
        {isOwner && <Button asChild variant="brand" className="flex-1"><Link href="/profile/edit"><Pencil className="size-4" /> Edit profile</Link></Button>}
        <Button variant="outline" className={cn(!isOwner && "flex-1")} onClick={() => void share()}><Share2 className="size-4" /> Share</Button>
      </div>
    </Card>
  );
}

export function BadgesGrid({ data, compact }: { data: AchievementsResponse | undefined; compact?: boolean }) {
  const [all, setAll] = useState(false);
  const items = useMemo(() => {
    if (!data) return [];
    const at = new Map(data.unlocked.map((u) => [u.id, u.at]));
    const list = data.catalog.map((c) => ({ ...c, at: at.get(c.id) ?? null }));
    // Unlocked first (newest), then locked.
    return list.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || (b.at ?? "").localeCompare(a.at ?? ""));
  }, [data]);
  const shown = all || compact ? items : items.slice(0, 12);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-md font-semibold text-text-1">Badges</h2>
        <span className="text-sm tabular text-text-2"><span className="font-semibold text-text-1">{data?.counts.unlocked ?? 0}</span> / {data?.counts.total ?? 0}</span>
      </div>
      <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
        {shown.map((b) => {
          const Icon = ICONS[b.icon] ?? Award;
          return (
            <li key={b.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div tabIndex={0} className={cn("flex aspect-square flex-col items-center justify-center rounded-card border text-center outline-none focus-visible:ring-[3px] focus-visible:ring-brand/40", b.unlocked ? "border-brand/30 bg-brand-soft text-brand" : "border-line bg-surface-1 text-text-3 opacity-60")}>
                    <span className="relative"><Icon className="size-6" />{!b.unlocked && <Lock className="absolute -bottom-1 -right-1.5 size-3 rounded-full bg-card p-px" />}</span>
                    <span className="mt-1.5 line-clamp-2 px-1 text-2xs leading-tight text-text-2">{b.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs"><p className="font-medium">{b.name}</p><p className="text-xs opacity-80">{b.description}</p>{b.at && <p className="mt-1 text-xs opacity-70">Unlocked {fmtDate(b.at)}</p>}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {!compact && items.length > 12 && <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${items.length}`}</Button>}
    </Card>
  );
}

const GROUPS: { key: string; label: string; test: (t: SkillTopic) => boolean }[] = [
  { key: "advanced", label: "Advanced", test: (t) => t.depth >= 2 },
  { key: "intermediate", label: "Intermediate", test: (t) => t.depth === 1 },
  { key: "fundamental", label: "Fundamental", test: (t) => t.depth === 0 },
];

export function SkillsList({ topics }: { topics: SkillTopic[] | undefined }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!topics) return null;
  return (
    <Card className="p-5">
      <h2 className="text-md font-semibold text-text-1">Skills</h2>
      <div className="mt-3 space-y-4">
        {GROUPS.map((g) => {
          const list = topics.filter(g.test).filter((t) => t.solved > 0).sort((a, b) => b.solved - a.solved || b.mastery - a.mastery);
          if (!list.length) return null;
          const shown = open[g.key] ? list : list.slice(0, 5);
          return (
            <div key={g.key}>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-3"><span className={cn("size-2 rounded-full", g.key === "advanced" ? "bg-hard" : g.key === "intermediate" ? "bg-medium" : "bg-easy")} />{g.label}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {shown.map((t) => (
                  <li key={t.topic} className="flex items-center gap-1.5 rounded-chip border border-line bg-surface-1 px-2 py-1 text-xs">
                    <span className="text-text-1">{t.name}</span><span className="tabular text-text-3">×{t.solved}</span>
                    {t.status === "mastered" && <Crown className="size-3 text-[#f5b301]" />}
                  </li>
                ))}
              </ul>
              {list.length > 5 && <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))} className="mt-1.5 text-xs text-brand hover:underline">{open[g.key] ? "Show less" : `Show ${list.length - 5} more`}</button>}
            </div>
          );
        })}
        {topics.every((t) => t.solved === 0) && <p className="text-sm text-text-3">Solve problems to build your skill profile.</p>}
      </div>
    </Card>
  );
}

export function RecentAccepted({ rows }: { rows: { id: string; title: string; slug: string; language: string; at: string }[] | undefined }) {
  return (
    <Card className="p-5">
      <h2 className="text-md font-semibold text-text-1">Recent accepted</h2>
      {!rows ? null : rows.length === 0 ? <p className="mt-2 text-sm text-text-3">No accepted submissions yet.</p> : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm"><Link href={`/problems/${r.slug}`} className="truncate font-medium text-text-1 hover:underline">{r.title}</Link><span className="shrink-0 text-xs text-text-3">{titleCase(r.language)} · {fmtDate(r.at, { month: "short", day: "numeric" })}</span></li>)}
        </ul>
      )}
    </Card>
  );
}

function GithubMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" /></svg>;
}
function LinkedinMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" /></svg>;
}
