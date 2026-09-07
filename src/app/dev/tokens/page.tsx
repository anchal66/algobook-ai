"use client";
/** `/dev/tokens` (Module 05 U-01): admin-only light/dark token verification page with live contrast ratios. */
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { AppShell, PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSegmented } from "@/components/shell/ThemeToggle";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";

const SURFACES = ["--surface-0", "--surface-1", "--surface-2", "--surface-3"];
const TEXTS = ["--text-1", "--text-2", "--text-3", "--brand", "--brand-2"];

function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function readVar(name: string): string {
  if (typeof window === "undefined") return "#000000";
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
}

export default function TokensPage() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const { resolvedTheme } = useTheme();
  // Recompute when the resolved theme changes (the class flips before next-themes re-renders us).
  const table = useMemo(() => {
    void user; void me; void resolvedTheme;
    return TEXTS.map((t) => ({ t, hex: readVar(t), cells: SURFACES.map((s) => ({ s, hex: readVar(s), ratio: contrast(readVar(t), readVar(s)) })) }));
  }, [user, me, resolvedTheme]);

  return (
    <AppShell>
      {me && !me.isAdmin ? (
        <EmptyState title="Admins only" description="This page verifies the design tokens and is restricted to admins." />
      ) : (
        <>
          <PageHeader eyebrow="Dev" title="Design tokens" description="Master Plan §8 palette with live WCAG contrast. Switch themes and confirm every text/surface pair ≥ 4.5 (AA) or ≥ 3 for large text." actions={<ThemeSegmented />} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card padding="md">
              <h3 className="mb-3 text-md font-semibold">Contrast matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-text-3"><th className="py-1.5 pr-3">text \ surface</th>{SURFACES.map((s) => <th key={s} className="py-1.5 pr-3 font-mono font-normal">{s.replace("--", "")}</th>)}</tr></thead>
                  <tbody>
                    {table.map((row) => (
                      <tr key={row.t} className="border-t border-line">
                        <td className="py-2 pr-3 font-mono text-xs"><span className="mr-2 inline-block size-3 rounded-sm align-middle" style={{ background: row.hex }} />{row.t.replace("--", "")}</td>
                        {row.cells.map((c) => (
                          <td key={c.s} className="py-2 pr-3">
                            <span className="rounded-[6px] px-2 py-1 tabular" style={{ background: c.hex, color: row.hex }}>{c.ratio.toFixed(2)}</span>
                            <span className={`ml-1 text-2xs ${c.ratio >= 4.5 ? "text-ok" : c.ratio >= 3 ? "text-warn" : "text-err"}`}>{c.ratio >= 4.5 ? "AA" : c.ratio >= 3 ? "AA-lg" : "fail"}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card padding="md" className="space-y-4">
              <h3 className="text-md font-semibold">Primitives</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="brand">Brand</Button><Button>Default</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button loading>Loading</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <DifficultyBadge difficulty="Easy" /><DifficultyBadge difficulty="Medium" /><DifficultyBadge difficulty="Hard" /><StatusBadge status="todo" /><StatusBadge status="attempting" /><StatusBadge status="solved" /><Badge variant="brand">brand</Badge><Badge variant="gradient">gradient</Badge><Badge variant="info">info</Badge>
              </div>
              <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Description</TabsTrigger><TabsTrigger value="b">Editorial</TabsTrigger><TabsTrigger value="c">Solutions</TabsTrigger></TabsList></Tabs>
              <Tabs defaultValue="a" variant="pill"><TabsList><TabsTrigger value="a">Global</TabsTrigger><TabsTrigger value="b">Weekly</TabsTrigger></TabsList></Tabs>
              <Progress value={64} />
              <div className="flex gap-2"><Skeleton className="h-10 flex-1" /><Skeleton className="size-10 rounded-full" /></div>
              <EmptyState compact icon={<Sparkles />} title="Empty state" description="Description text at text-2." action={<Button size="sm" variant="brand">Action</Button>} />
            </Card>
            <Card padding="md" className="lg:col-span-2">
              <h3 className="mb-3 text-md font-semibold">Surfaces</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SURFACES.map((s, i) => (
                  <div key={s} className="rounded-card border border-line p-4" style={{ background: `var(${s})` }}>
                    <p className="font-mono text-xs text-text-3">{s}</p>
                    <p className="text-text-1">Primary text</p><p className="text-sm text-text-2">Secondary text</p><p className="text-xs text-text-3">Tertiary text</p>
                    <p className="mt-2 text-sm text-brand">Brand link · level {i}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
