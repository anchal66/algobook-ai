"use client";
/** Profile edit (Module 05 U-16, port of v1 with the same validations). */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorText } from "@/lib/app/errors";
import { AtSign, Check, Loader2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { checkUsername, patchMe, setUsername as apiSetUsername } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SKILLS_LIST } from "@/lib/skills";
import { GOALS, LEVELS } from "@/components/wizard/steps";
import type { ExperienceLevel, GoalType } from "@/types";

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
const URL_OK = (v: string, host: string) => v === "" || (/^https?:\/\//.test(v) && v.includes(host));

export default function ProfileEditPage() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const load = useMe((s) => s.load);
  const router = useRouter();
  const [form, setForm] = useState<{ displayName: string; bio: string; company: string; college: string; location: string; githubUrl: string; linkedinUrl: string; skills: string[]; experienceLevel: ExperienceLevel; goalType: GoalType } | null>(null);
  const [saving, setSaving] = useState(false);
  const [skillQ, setSkillQ] = useState("");
  const [uname, setUname] = useState("");
  const [avail, setAvail] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [savingU, setSavingU] = useState(false);

  useEffect(() => {
    if (me && !form) {
      const u = me.user;
      setForm({ displayName: u.displayName, bio: u.bio, company: u.company, college: u.college, location: u.location, githubUrl: u.githubUrl, linkedinUrl: u.linkedinUrl, skills: u.skills, experienceLevel: u.experienceLevel, goalType: u.goalType });
      setUname(u.username);
    }
  }, [me, form]);

  // Debounced availability check (500 ms), same rules as v1.
  useEffect(() => {
    if (!me || uname === me.user.username) { setAvail("idle"); return; }
    if (!USERNAME_RE.test(uname)) { setAvail("invalid"); return; }
    setAvail("checking");
    const t = setTimeout(() => { checkUsername(uname).then((r) => setAvail(r.available ? "ok" : "taken")).catch(() => setAvail("taken")); }, 500);
    return () => clearTimeout(t);
  }, [uname, me]);

  const suggestions = useMemo(() => { const q = skillQ.trim().toLowerCase(); if (!q || !form) return []; return SKILLS_LIST.filter((s) => s.toLowerCase().includes(q) && !form.skills.includes(s)).slice(0, 15); }, [skillQ, form]);
  if (!me || !form || !user) return <Skeleton className="h-96" />;
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p });
  const changesLeft = me.user.usernameChangesLeft;

  const save = async () => {
    if (!form.displayName.trim()) { toast.error("Display name is required."); return; }
    if (!URL_OK(form.githubUrl, "github.com")) { toast.error("GitHub URL must start with https:// and point to github.com."); return; }
    if (!URL_OK(form.linkedinUrl, "linkedin.com")) { toast.error("LinkedIn URL must start with https:// and point to linkedin.com."); return; }
    setSaving(true);
    try { await patchMe({ ...form, displayName: form.displayName.trim() }); await load(user.uid, true); toast.success("Profile saved"); router.push("/profile"); } catch (e) { toast.error(errorText(e)); } finally { setSaving(false); }
  };
  const saveUsername = async () => {
    setSavingU(true);
    try { const r = await apiSetUsername(uname); await load(user.uid, true); toast.success(`Username is now @${r.username} · ${r.changesLeft} change${r.changesLeft === 1 ? "" : "s"} left`); } catch (e) { toast.error(errorText(e)); } finally { setSavingU(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit profile" description="What appears on your public profile and leaderboard rows." />
      <Card className="p-5">
        <h2 className="text-md font-semibold text-text-1">Username</h2>
        <p className="mt-1 text-sm text-text-2">{changesLeft > 0 ? `You can change your username ${changesLeft} more time${changesLeft === 1 ? "" : "s"}.` : "You've used all your username changes."}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
            <Input value={uname} maxLength={20} disabled={changesLeft <= 0} onChange={(e) => setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="pl-9 pr-9 font-mono" aria-label="Username" aria-invalid={avail === "invalid" || avail === "taken"} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{avail === "checking" ? <Loader2 className="size-4 animate-spin text-text-3" /> : avail === "ok" ? <Check className="size-4 text-ok" /> : avail === "taken" || avail === "invalid" ? <X className="size-4 text-err" /> : null}</span>
          </div>
          <Button variant="brand" disabled={avail !== "ok" || changesLeft <= 0} loading={savingU} onClick={() => void saveUsername()}>Update username</Button>
        </div>
        <p className="mt-1.5 text-xs text-text-3">{avail === "invalid" ? <span className="text-err">3–20 chars, lowercase letters, numbers, underscores. Must start with a letter.</span> : avail === "taken" ? <span className="text-err">Username is taken or reserved.</span> : <>Your public page: algobook.ai/{uname || "username"}</>}</p>
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="e-name">Display name</Label><Input id="e-name" value={form.displayName} maxLength={60} onChange={(e) => set({ displayName: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="e-bio">Bio</Label><Textarea id="e-bio" value={form.bio} maxLength={300} rows={3} onChange={(e) => set({ bio: e.target.value })} placeholder="Backend engineer, prepping for FAANG loops. Love graphs." /><span className="text-right text-2xs tabular text-text-3">{form.bio.length}/300</span></div>
          <div className="grid gap-1.5"><Label htmlFor="e-company">Company</Label><Input id="e-company" value={form.company} maxLength={80} onChange={(e) => set({ company: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="e-college">College</Label><Input id="e-college" value={form.college} maxLength={120} onChange={(e) => set({ college: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="e-location">Location</Label><Input id="e-location" value={form.location} maxLength={80} onChange={(e) => set({ location: e.target.value })} placeholder="Bengaluru, India" /></div>
          <div className="grid gap-1.5"><Label htmlFor="e-gh">GitHub URL</Label><Input id="e-gh" type="url" value={form.githubUrl} onChange={(e) => set({ githubUrl: e.target.value.trim() })} placeholder="https://github.com/you" aria-invalid={!URL_OK(form.githubUrl, "github.com")} /></div>
          <div className="grid gap-1.5"><Label htmlFor="e-li">LinkedIn URL</Label><Input id="e-li" type="url" value={form.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value.trim() })} placeholder="https://linkedin.com/in/you" aria-invalid={!URL_OK(form.linkedinUrl, "linkedin.com")} /></div>
          <div className="grid gap-1.5"><Label>Experience level</Label><Select value={form.experienceLevel} onValueChange={(v) => set({ experienceLevel: v as ExperienceLevel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map((l) => <SelectItem key={l.v} value={l.v}>{l.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1.5"><Label>Primary goal</Label><Select value={form.goalType} onValueChange={(v) => set({ goalType: v as GoalType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GOALS.map((g) => <SelectItem key={g.v} value={g.v}>{g.title}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div>
          <Label htmlFor="e-skills">Skills <span className="text-text-3">({form.skills.length}/20)</span></Label>
          <div className="mt-2 flex flex-wrap gap-1.5">{form.skills.map((s) => <Badge key={s} variant="brand" className="gap-1 pr-1">{s}<button type="button" aria-label={`Remove ${s}`} onClick={() => set({ skills: form.skills.filter((x) => x !== s) })} className="rounded-full p-0.5 hover:bg-brand/20"><X className="size-3" /></button></Badge>)}</div>
          <div className="relative mt-2">
            <Input id="e-skills" value={skillQ} onChange={(e) => setSkillQ(e.target.value)} placeholder="Type to search skills (e.g. Java, System Design)" disabled={form.skills.length >= 20}
              onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) { e.preventDefault(); set({ skills: [...form.skills, suggestions[0]] }); setSkillQ(""); } }} />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[10px] border border-line bg-popover p-1 shadow-xl" role="listbox">
                {suggestions.map((s) => <li key={s}><button type="button" role="option" aria-selected={false} onClick={() => { set({ skills: [...form.skills, s] }); setSkillQ(""); }} className="w-full rounded-[6px] px-2 py-1.5 text-left text-sm text-text-1 hover:bg-surface-2">{s}</button></li>)}
              </ul>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="ghost" onClick={() => router.push("/profile")}>Cancel</Button><Button variant="brand" loading={saving} onClick={() => void save()}>Save profile</Button></div>
      </Card>
    </div>
  );
}
