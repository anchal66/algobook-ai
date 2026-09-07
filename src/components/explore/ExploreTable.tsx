"use client";
/** Virtualised problemset table (Module 05 U-13): sticky header, sortable columns, LeetCode column set. */
import Link from "next/link";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, CircleDashed } from "lucide-react";
import type { CatalogRow } from "@/lib/app/api";
import { DifficultyBadge, Badge } from "@/components/ui/badge";
import { statusOf, type SortKey, type StatusMap } from "@/components/explore/filters";
import { titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

const ROW_H = 48;
const COLS = "grid-cols-[44px_minmax(220px,1fr)_96px_96px_80px_minmax(160px,0.8fr)]";

export interface ExploreTableProps {
  rows: CatalogRow[]; statuses: StatusMap; sort: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; height?: number;
}

export function ExploreTable({ rows, statuses, sort, dir, onSort, height = 640 }: ExploreTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW_H, overscan: 12 });

  const Th = ({ k, children, className }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <div role="columnheader" aria-sort={k && sort === k ? (dir === "asc" ? "ascending" : "descending") : undefined} className={cn("flex items-center px-3 text-xs font-medium uppercase tracking-wider text-text-3", className)}>
      {k ? (
        <button type="button" onClick={() => onSort(k)} className="flex items-center gap-1 hover:text-text-1">
          {children}
          {sort === k ? (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
        </button>
      ) : children}
    </div>
  );

  return (
    <div role="table" aria-rowcount={rows.length} className="overflow-hidden rounded-card border border-line bg-card">
      <div ref={parentRef} className="scroll-thin overflow-auto" style={{ maxHeight: height }}>
        <div className="min-w-[760px]">
          <div role="row" className={cn("sticky top-0 z-10 grid h-10 border-b border-line bg-surface-1/95 backdrop-blur", COLS)}>
            <Th className="justify-center">✓</Th>
            <Th k="title">Title</Th>
            <Th k="difficulty">Difficulty</Th>
            <Th k="acceptance">Acceptance</Th>
            <Th k="rating">Rating</Th>
            <Th>Topics</Th>
          </div>
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((vi) => {
              const r = rows[vi.index];
              const st = statusOf(r.id, statuses);
              return (
                <Link
                  key={r.id}
                  href={`/problems/${r.slug}`}
                  role="row"
                  aria-rowindex={vi.index + 1}
                  className={cn("absolute left-0 grid w-full items-center border-b border-line/60 text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none", COLS, vi.index % 2 ? "bg-surface-1/40" : "")}
                  style={{ top: vi.start, height: ROW_H }}
                >
                  <span role="cell" className="flex justify-center" aria-label={st}>
                    {st === "solved" ? <Check className="size-4 text-ok" /> : st === "attempting" ? <CircleDashed className="size-4 text-medium" /> : <span className="size-4" />}
                  </span>
                  <span role="cell" className="truncate px-3 font-medium text-text-1"><span className="tabular text-text-3">{r.number ? `${r.number}. ` : ""}</span>{r.title}</span>
                  <span role="cell" className="px-3"><DifficultyBadge difficulty={r.difficulty} plain /></span>
                  <span role="cell" className="px-3 tabular text-text-2">{r.acceptanceRate.toFixed(1)}%</span>
                  <span role="cell" className="px-3 tabular text-text-2">{Math.round(r.rating)}</span>
                  <span role="cell" className="flex gap-1 overflow-hidden px-3">{r.tags.slice(0, 3).map((t) => <Badge key={t} size="sm" className="shrink-0">{titleCase(t)}</Badge>)}{r.tags.length > 3 && <span className="text-xs text-text-3">+{r.tags.length - 3}</span>}</span>
                </Link>
              );
            })}
          </div>
          {rows.length === 0 && <div className="py-16 text-center text-sm text-text-3">No problems match these filters.</div>}
        </div>
      </div>
    </div>
  );
}
