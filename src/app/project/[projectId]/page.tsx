"use client";
/** `/project/:id` → first unsolved item, or `/solve/next` when nothing is queued (Module 03 W-29). */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getProject } from "@/lib/workspace/api";

export default function ProjectRootPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    let cancelled = false;
    getProject(projectId)
      .then(({ items }) => {
        if (cancelled) return;
        const next = items.find((i) => i.status !== "solved") ?? items[items.length - 1];
        router.replace(next ? `/project/${projectId}/solve/${next.problemId}` : `/project/${projectId}/solve/next`);
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [loading, user, projectId, router]);

  return (
    <div className="flex h-dvh items-center justify-center bg-ws-page text-fg-2">
      {error ? <p className="text-sm text-wrong">{error}</p> : <Loader2 className="size-5 animate-spin" />}
    </div>
  );
}
