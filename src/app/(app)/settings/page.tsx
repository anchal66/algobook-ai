"use client";
/** Settings (Module 05 U-19): Account · Plan & billing · Appearance · Editor defaults · Notifications · Privacy · Danger zone. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import { AlertTriangle, Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { useSettings, FONT_OPTIONS } from "@/store/settings";
import { useQuery, clearQueries } from "@/lib/app/query";
import { deleteMe, listInvoices, patchMe, patchNotifications, startCheckout } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeSegmented } from "@/components/shell/ThemeToggle";
import { PLAN_LIMITS } from "@/lib/plans";
import { fmtDate, INR, titleCase } from "@/lib/app/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const SECTIONS = [["account", "Account"], ["plan", "Plan & billing"], ["appearance", "Appearance"], ["editor", "Editor defaults"], ["notifications", "Notifications"], ["privacy", "Privacy"], ["danger", "Danger zone"]] as const;
const FEATURE_LABEL: Record<string, string> = { generate: "AI generations", run: "Runs", submit: "Submits", hint3: "Level-3 hints", editorial: "Editorials", chat: "Tutor messages", completion: "Inline completions", review: "Code reviews", interview: "Mock interviews" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20 p-5">
      <h2 className="text-md font-semibold text-text-1">{title}</h2>
      {description && <p className="mt-1 text-sm text-text-2">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0"><div><p className="text-sm font-medium text-text-1">{label}</p>{hint && <p className="text-xs text-text-3">{hint}</p>}</div><div className="shrink-0">{children}</div></div>;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const load = useMe((s) => s.load);
  const router = useRouter();
  const editor = useSettings((s) => s.editor);
  const setEditor = useSettings((s) => s.setEditor);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [checkout, setCheckout] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delText, setDelText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const invoices = useQuery(user ? "/api/subscription/invoices" : null, listInvoices, { staleMs: 60_000 });
  useEffect(() => { if (me && !name) setName(me.user.displayName); }, [me, name]);

  if (!me || !user) return <Skeleton className="h-96" />;
  const pro = me.plan.tier === "pro";
  const notif = me.user.settings.notifications;

  const saveName = async () => { setSavingName(true); try { await patchMe({ displayName: name.trim() }); await load(user.uid, true); toast.success("Name updated"); } catch (e) { toast.error((e as Error).message); } finally { setSavingName(false); } };
  const buy = async (plan: "pro-monthly" | "pro-yearly") => {
    setCheckout(plan); track("checkout_start", { plan });
    try { const { checkoutUrl } = await startCheckout(plan); window.location.assign(checkoutUrl); } catch (e) { toast.error((e as Error).message); setCheckout(null); }
  };
  const toggleNotif = async (patch: { dailyReminder?: boolean; streakAlerts?: boolean }) => { try { await patchNotifications(patch); await load(user.uid, true); } catch (e) { toast.error((e as Error).message); } };
  const togglePublic = async (v: boolean) => { try { await patchMe({ publicProfile: v }); await load(user.uid, true); toast.success(v ? "Profile is public" : "Profile is private"); } catch (e) { toast.error((e as Error).message); } };
  const del = async () => {
    setDeleting(true);
    try { await deleteMe(); clearQueries(); useMe.getState().reset(); await signOut(auth); toast.success("Account deleted"); router.push("/"); } catch (e) { toast.error((e as Error).message); setDeleting(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-20 space-y-0.5 text-sm">{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className={cn("block rounded-[8px] px-3 py-2 text-text-2 hover:bg-surface-2 hover:text-text-1", id === "danger" && "text-err")}>{label}</a></li>)}</ul>
      </nav>
      <div className="space-y-4">
        <PageHeader title="Settings" className="mb-2" />

        <Section id="account" title="Account">
          <Row label="Display name"><div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-48" aria-label="Display name" /><Button size="sm" variant="secondary" loading={savingName} disabled={name.trim() === me.user.displayName || !name.trim()} onClick={() => void saveName()}>Save</Button></div></Row>
          <Row label="Email" hint="From your Google account"><span className="text-sm text-text-2">{me.user.email || user.email}</span></Row>
          <Row label="Username" hint={`@${me.user.username}`}><Button asChild size="sm" variant="outline"><Link href="/profile/edit">Change</Link></Button></Row>
        </Section>

        <Section id="plan" title="Plan & billing" description="Pro renews manually — there is never an automatic charge (D-13).">
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface-1 p-4">
            <Badge variant={pro ? "gradient" : "outline"} size="lg">{pro ? "Pro" : "Free"}</Badge>
            <div className="text-sm text-text-2">
              {pro ? <>Active{me.plan.endDate && <> · valid until <span className="font-medium text-text-1">{fmtDate(me.plan.endDate)}</span></>}{me.plan.planSlug && <> · {titleCase(me.plan.planSlug)}</>}</> : me.plan.status === "expired" ? <>Your Pro plan expired{me.plan.endDate && ` on ${fmtDate(me.plan.endDate)}`}. Renew to unlock everything again.</> : <>You&rsquo;re on the Free plan. Upgrade for editorials, the AI tutor, code review and mock interviews.</>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[["pro-monthly", "Pro Monthly", "₹499", "/ 30 days"], ["pro-yearly", "Pro Yearly", "₹4,999", "/ year · save 17%"]].map(([slug, title, price, per]) => (
              <div key={slug} className={cn("rounded-card border p-4", slug === "pro-yearly" ? "border-brand/40 bg-brand-soft/40" : "border-line")}>
                <p className="text-sm font-semibold text-text-1">{title}</p>
                <p className="mt-1 text-2xl font-semibold tabular text-text-1">{price}<span className="text-sm font-normal text-text-3"> {per}</span></p>
                <Button variant={slug === "pro-yearly" ? "brand" : "outline"} className="mt-3 w-full" loading={checkout === slug} onClick={() => void buy(slug as "pro-monthly" | "pro-yearly")}><Sparkles className="size-4" />{pro ? "Extend" : "Upgrade"}</Button>
              </div>
            ))}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-text-2 hover:text-text-1">Daily limits on your plan</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(PLAN_LIMITS[me.plan.tier]).map(([k, v]) => <li key={k} className="flex justify-between rounded-[6px] bg-surface-1 px-2 py-1"><span className="text-text-2">{FEATURE_LABEL[k] ?? k}</span><span className="tabular text-text-1">{v < 0 ? "Unlimited" : v === 0 ? <span className="text-text-3">Pro</span> : `${me.quotas.used[k as keyof typeof me.quotas.used] ?? 0} / ${v}`}</span></li>)}
            </ul>
          </details>
          <div className="mt-4">
            <p className="flex items-center gap-2 text-sm font-medium text-text-1"><CreditCard className="size-4 text-text-3" /> Invoices</p>
            {invoices.loading ? <Skeleton className="mt-2 h-10" /> : invoices.data?.invoices.length ? (
              <table className="mt-2 w-full text-sm"><tbody>{invoices.data.invoices.map((i) => <tr key={i.id} className="border-t border-line"><td className="py-2 text-text-1">{i.planName}</td><td className="py-2 text-text-2">{fmtDate(i.createdAt)}</td><td className="py-2 text-text-2">{fmtDate(i.startDate, { month: "short", day: "numeric" })} – {fmtDate(i.endDate)}</td><td className="py-2 text-right tabular text-text-1">{INR(i.amountInPaise)}</td><td className="py-2 text-right"><Badge size="sm" variant={i.status === "active" ? "ok" : "neutral"}>{titleCase(i.status)}</Badge></td></tr>)}</tbody></table>
            ) : <p className="mt-1 text-sm text-text-3">No invoices yet.</p>}
          </div>
        </Section>

        <Section id="appearance" title="Appearance" description="Applies to the whole app, including the workspace editor theme.">
          <ThemeSegmented />
        </Section>

        <Section id="editor" title="Editor defaults" description="Mirrors the workspace Settings dialog; saved to your account.">
          <Row label="Font"><Select value={editor.font} onValueChange={(v) => setEditor({ font: v })}><SelectTrigger className="w-44" aria-label="Font"><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></Row>
          <Row label="Font size"><Select value={String(editor.fontSize)} onValueChange={(v) => setEditor({ fontSize: Number(v) })}><SelectTrigger className="w-24" aria-label="Font size"><SelectValue /></SelectTrigger><SelectContent>{[12, 13, 14, 15, 16, 18, 20].map((n) => <SelectItem key={n} value={String(n)}>{n}px</SelectItem>)}</SelectContent></Select></Row>
          <Row label="Tab size"><Select value={String(editor.tabSize)} onValueChange={(v) => setEditor({ tabSize: Number(v) })}><SelectTrigger className="w-24" aria-label="Tab size"><SelectValue /></SelectTrigger><SelectContent>{[2, 4, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></Row>
          <Row label="Key bindings"><Select value={editor.keyBinding} onValueChange={(v) => setEditor({ keyBinding: v as typeof editor.keyBinding })}><SelectTrigger className="w-32" aria-label="Key bindings"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="vim">Vim</SelectItem><SelectItem value="emacs">Emacs</SelectItem></SelectContent></Select></Row>
          <Row label="Default language"><Select value={editor.language} onValueChange={(v) => setEditor({ language: v as typeof editor.language })}><SelectTrigger className="w-36" aria-label="Default language"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="java">Java</SelectItem><SelectItem value="python">Python 3</SelectItem><SelectItem value="cpp">C++</SelectItem><SelectItem value="javascript">JavaScript</SelectItem></SelectContent></Select></Row>
          <Row label="Font ligatures"><Switch checked={editor.ligatures} onCheckedChange={(v) => setEditor({ ligatures: v })} aria-label="Font ligatures" /></Row>
          <Row label="Word wrap"><Switch checked={editor.wordWrap} onCheckedChange={(v) => setEditor({ wordWrap: v })} aria-label="Word wrap" /></Row>
          <Row label="Relative line numbers"><Switch checked={editor.relativeLineNumbers} onCheckedChange={(v) => setEditor({ relativeLineNumbers: v })} aria-label="Relative line numbers" /></Row>
          <Row label="Minimap"><Switch checked={editor.minimap} onCheckedChange={(v) => setEditor({ minimap: v })} aria-label="Minimap" /></Row>
          <Row label="AI inline completion" hint={pro ? "Ghost-text suggestions while you type" : "Pro feature"}><Switch checked={editor.aiCompletion} disabled={!pro} onCheckedChange={(v) => setEditor({ aiCompletion: v })} aria-label="AI inline completion" /></Row>
        </Section>

        <Section id="notifications" title="Notifications" description="Preferences are stored now; email delivery arrives with the notification service.">
          <Row label="Daily reminder email" hint="A nudge when you haven't practised by evening"><Switch checked={notif.dailyReminder} onCheckedChange={(v) => void toggleNotif({ dailyReminder: v })} aria-label="Daily reminder email" /></Row>
          <Row label="Streak alerts" hint="Warn me before a streak breaks"><Switch checked={notif.streakAlerts} onCheckedChange={(v) => void toggleNotif({ streakAlerts: v })} aria-label="Streak alerts" /></Row>
        </Section>

        <Section id="privacy" title="Privacy">
          <Row label="Public profile" hint={`algobook.ai/${me.user.username} and leaderboard rows`}><Switch checked={(me.user as { publicProfile?: boolean }).publicProfile !== false} onCheckedChange={(v) => void togglePublic(v)} aria-label="Public profile" /></Row>
          <Row label="Legal"><div className="flex gap-3 text-sm"><Link href="/privacy" className="flex items-center gap-1 text-text-2 hover:text-text-1">Privacy <ExternalLink className="size-3" /></Link><Link href="/terms" className="flex items-center gap-1 text-text-2 hover:text-text-1">Terms <ExternalLink className="size-3" /></Link></div></Row>
        </Section>

        <Card id="danger" className="scroll-mt-20 border-err/30 p-5">
          <h2 className="flex items-center gap-2 text-md font-semibold text-err"><AlertTriangle className="size-4" /> Danger zone</h2>
          <p className="mt-1 text-sm text-text-2">Deleting your account removes your profile, projects, submissions, notes, activity and achievements. The subscription ledger is kept for accounting. This cannot be undone.</p>
          <Button variant="destructive" className="mt-4" onClick={() => setConfirmDel(true)}>Delete account</Button>
        </Card>
      </div>

      <Dialog open={confirmDel} onOpenChange={(v) => { setConfirmDel(v); if (!v) setDelText(""); }}>
        <DialogContent className="rounded-modal border-line bg-card sm:max-w-md">
          <DialogHeader><DialogTitle>Delete your account?</DialogTitle><DialogDescription>Type <span className="font-mono font-semibold text-text-1">DELETE</span> to confirm. You will be signed out.</DialogDescription></DialogHeader>
          <Input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="DELETE" aria-label="Confirmation" />
          <DialogFooter><Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancel</Button><Button variant="destructive" disabled={delText !== "DELETE"} loading={deleting} onClick={() => void del()}><Check className="size-4" /> Delete permanently</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
