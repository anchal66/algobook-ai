"use client";
/** Admin console (Module 05 U-20, D-12). Guarded by `isAdmin` from /api/me; every route re-checks server-side. */
import { useMe } from "@/store/me";
import { PageHeader } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { CoveragePanel, FlaggedPanel, TriggersPanel, UsagePanel } from "@/components/admin/panels";

export default function AdminPage() {
  const me = useMe((s) => s.me);
  if (!me) return <Skeleton className="h-96" />;
  if (!me.isAdmin) return <EmptyState icon={<ShieldCheck />} title="Admins only" description="This console is limited to the ADMIN_UIDS allowlist." />;
  return (
    <>
      <PageHeader title="Admin console" description="AI spend, pool coverage, moderation queue and job triggers." />
      <div className="grid gap-4 xl:grid-cols-2">
        <UsagePanel />
        <CoveragePanel />
        <FlaggedPanel />
        <TriggersPanel />
      </div>
    </>
  );
}
