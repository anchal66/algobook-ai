"use client";
/** Explore — public problem bank (Module 05 U-13, D-06). Catalog is filtered/sorted client-side; filters live in the URL. */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Compass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/lib/app/query";
import { getCatalog, getProblemStatus } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExploreTable } from "@/components/explore/ExploreTable";
import { FilterBar } from "@/components/explore/FilterBar";
import { applyFilters, companyCounts, fromSearchParams, pickRandom, statusOf, toSearchParams, topicCounts, type ExploreFilters, type StatusMap } from "@/components/explore/filters";
import { track } from "@/lib/analytics";
import { titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

function ExploreInner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const urlFilters = useMemo(() => fromSearchParams(new URLSearchParams(sp.toString())), [sp]);
  const [f, setF] = useState<ExploreFilters>(urlFilters);
  const [tableH, setTableH] = useState(640);

  // Keep the URL in sync (replace, so back navigation returns to the previous page with filters intact).
  const onChange = useCallback((patch: Partial<ExploreFilters>) => {
    setF((prev) => {
      const next = { ...prev, ...patch };
      const qs = toSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return next;
    });
  }, [router, pathname]);

  useEffect(() => {
    const fit = () => setTableH(Math.max(420, window.innerHeight - 330));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const catalog = useQuery(user ? "/api/problems/catalog" : null, getCatalog, { staleMs: 60_000 });
  const status = useQuery(user ? "/api/me/problem-status" : null, getProblemStatus, { staleMs: 30_000 });

  const statuses = useMemo<StatusMap>(() => {
    const m: StatusMap = new Map();
    for (const id of status.data?.attempting ?? []) m.set(id, "attempting");
    for (const id of status.data?.solved ?? []) m.set(id, "solved");
    return m;
  }, [status.data]);

  const all = catalog.data?.items ?? [];
  const rows = useMemo(() => applyFilters(all, f, statuses), [all, f, statuses]);
  const topics = useMemo(() => topicCounts(all), [all]);
  const companies = useMemo(() => companyCounts(all), [all]);
  const solvedCount = useMemo(() => all.filter((r) => statusOf(r.id, statuses) === "solved").length, [all, statuses]);

  const random = () => {
    const pool = rows.filter((r) => statusOf(r.id, statuses) !== "solved");
    const pick = pickRandom(pool.length ? pool : rows);
    if (!pick) { toast.message("Nothing to pick from with these filters."); return; }
    track("explore_pick_random");
    router.push(`/problems/${pick.slug}`);
  };

  const onSort = (k: ExploreFilters["sort"]) => onChange({ sort: k, dir: f.sort === k ? (f.dir === "asc" ? "desc" : "asc") : k === "acceptance" || k === "rating" ? "desc" : "asc" });

  return (
    <>
      <PageHeader
        title="Explore"
        description={<>Every verified problem in the shared bank. {all.length > 0 && <>You&rsquo;ve solved <span className="font-medium text-text-1 tabular">{solvedCount}</span> of {all.length.toLocaleString()}.</>}</>}
      />
      {topics.length > 0 && (
        <div className="mask-fade-x no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="list" aria-label="Topics">
          {topics.slice(0, 24).map((t) => {
            const on = f.topics.includes(t.tag);
            return (
              <button key={t.tag} type="button" role="listitem" onClick={() => onChange({ topics: on ? f.topics.filter((x) => x !== t.tag) : [...f.topics, t.tag] })} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors", on ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-text-2 hover:border-line-strong hover:text-text-1")}>
                {titleCase(t.tag)}<Badge size="sm" variant={on ? "brand" : "neutral"}>{t.count}</Badge>
              </button>
            );
          })}
        </div>
      )}
      <FilterBar f={f} onChange={onChange} topics={topics} companies={companies} onRandom={random} total={all.length} shown={rows.length} />
      <div className="mt-4">
        {catalog.loading ? (
          <Skeleton className="h-[520px]" />
        ) : catalog.error ? (
          <EmptyState icon={<Compass />} title="Couldn't load the problem bank" description={catalog.error.message} action={<Button variant="outline" onClick={() => void catalog.refetch()}>Retry</Button>} />
        ) : all.length === 0 ? (
          <EmptyState icon={<Compass />} title="The bank is filling up" description="Verified problems appear here as they are generated. Create a project to generate your first ones." />
        ) : (
          <ExploreTable rows={rows} statuses={statuses} sort={f.sort} dir={f.dir} onSort={onSort} height={tableH} />
        )}
      </div>
    </>
  );
}

export default function ExplorePage() {
  return <Suspense fallback={<Skeleton className="h-[600px]" />}><ExploreInner /></Suspense>;
}
