"use client";
/** Explore filter bar (Module 05 U-13): search · difficulty · status · topics · companies · rating range · sort · random pick. */
import { useState } from "react";
import { Check, ChevronDown, Dices, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_FILTERS, type ExploreFilters, type SortKey } from "@/components/explore/filters";
import { COMPANY_LABEL } from "@/components/dashboard/ProjectCard";
import { titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  f: ExploreFilters; onChange: (patch: Partial<ExploreFilters>) => void;
  topics: { tag: string; count: number }[]; companies: { company: string; count: number }[];
  onRandom: () => void; total: number; shown: number;
}

const ANY = "__any";

export function FilterBar({ f, onChange, topics, companies, onRandom, total, shown }: FilterBarProps) {
  const [topicQ, setTopicQ] = useState("");
  const active = [f.difficulty, f.status, f.company, f.minRating !== null || f.maxRating !== null ? "r" : "", ...f.topics].filter(Boolean).length;
  const visibleTopics = topics.filter((t) => !topicQ || t.tag.includes(topicQ.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
          <Input value={f.q} onChange={(e) => onChange({ q: e.target.value })} placeholder="Search title, #number or topic" className="pl-9" aria-label="Search problems" />
        </div>
        <Select value={f.difficulty || ANY} onValueChange={(v) => onChange({ difficulty: v === ANY ? "" : (v as ExploreFilters["difficulty"]) })}>
          <SelectTrigger className="w-[130px]" aria-label="Difficulty"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent><SelectItem value={ANY}>Difficulty</SelectItem><SelectItem value="Easy">Easy</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Hard">Hard</SelectItem></SelectContent>
        </Select>
        <Select value={f.status || ANY} onValueChange={(v) => onChange({ status: v === ANY ? "" : (v as ExploreFilters["status"]) })}>
          <SelectTrigger className="w-[130px]" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value={ANY}>Status</SelectItem><SelectItem value="todo">Todo</SelectItem><SelectItem value="attempting">Attempting</SelectItem><SelectItem value="solved">Solved</SelectItem></SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("gap-1.5", f.topics.length && "border-brand text-brand")}>Topics {f.topics.length ? <Badge variant="brand" size="sm">{f.topics.length}</Badge> : null}<ChevronDown className="size-4 opacity-60" /></Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 rounded-[12px] border-line bg-popover p-2">
            <Input value={topicQ} onChange={(e) => setTopicQ(e.target.value)} placeholder="Filter topics" className="mb-2 h-8" aria-label="Filter topics" />
            <ul className="scroll-thin max-h-64 overflow-y-auto">
              {visibleTopics.map((t) => {
                const on = f.topics.includes(t.tag);
                return (
                  <li key={t.tag}>
                    <button type="button" onClick={() => onChange({ topics: on ? f.topics.filter((x) => x !== t.tag) : [...f.topics, t.tag] })} className={cn("flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-sm hover:bg-surface-2", on ? "text-text-1" : "text-text-2")}>
                      <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", on ? "border-brand bg-brand text-white" : "border-line-strong")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                      <span className="flex-1 truncate text-left">{titleCase(t.tag)}</span>
                      <span className="tabular text-xs text-text-3">{t.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {f.topics.length > 0 && <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange({ topics: [] })}>Clear topics</Button>}
          </PopoverContent>
        </Popover>
        {companies.length > 0 && (
          <Select value={f.company || ANY} onValueChange={(v) => onChange({ company: v === ANY ? "" : v })}>
            <SelectTrigger className="w-[140px]" aria-label="Company"><SelectValue placeholder="Company" /></SelectTrigger>
            <SelectContent><SelectItem value={ANY}>Company</SelectItem>{companies.map((c) => <SelectItem key={c.company} value={c.company}>{COMPANY_LABEL[c.company] ?? titleCase(c.company)} ({c.count})</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("gap-1.5", (f.minRating !== null || f.maxRating !== null) && "border-brand text-brand")}>Rating<ChevronDown className="size-4 opacity-60" /></Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-[12px] border-line bg-popover p-3">
            <p className="mb-2 text-xs text-text-3">Problem rating range</p>
            <div className="flex items-center gap-2">
              <Input type="number" inputMode="numeric" value={f.minRating ?? ""} onChange={(e) => onChange({ minRating: e.target.value ? Number(e.target.value) : null })} placeholder="800" aria-label="Min rating" className="h-8" />
              <span className="text-text-3">–</span>
              <Input type="number" inputMode="numeric" value={f.maxRating ?? ""} onChange={(e) => onChange({ maxRating: e.target.value ? Number(e.target.value) : null })} placeholder="2400" aria-label="Max rating" className="h-8" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[[800, 1200, "≤1200"], [1200, 1500, "1200–1500"], [1500, 1800, "1500–1800"], [1800, 3000, "1800+"]].map(([a, b, l]) => (
                <button key={l} type="button" onClick={() => onChange({ minRating: a as number, maxRating: b as number })} className="rounded-chip bg-surface-2 px-2 py-1 text-xs text-text-2 hover:text-text-1">{l}</button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Select value={`${f.sort}:${f.dir}`} onValueChange={(v) => { const [sort, dir] = v.split(":") as [SortKey, "asc" | "desc"]; onChange({ sort, dir }); }}>
          <SelectTrigger className="w-[160px]" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="number:asc">Number ↑</SelectItem><SelectItem value="newest:asc">Newest first</SelectItem><SelectItem value="acceptance:desc">Acceptance ↓</SelectItem><SelectItem value="acceptance:asc">Acceptance ↑</SelectItem><SelectItem value="rating:asc">Rating ↑</SelectItem><SelectItem value="rating:desc">Rating ↓</SelectItem><SelectItem value="title:asc">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="brand" onClick={onRandom} className="ml-auto gap-2"><Dices className="size-4" /> Pick one for me</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
        <span className="tabular"><span className="font-medium text-text-1">{shown.toLocaleString()}</span> of {total.toLocaleString()} problems</span>
        {active > 0 && (
          <>
            <span aria-hidden>·</span>
            {f.topics.map((t) => <button key={t} type="button" onClick={() => onChange({ topics: f.topics.filter((x) => x !== t) })} className="flex items-center gap-1 rounded-chip bg-brand-soft px-2 py-0.5 text-brand">{titleCase(t)}<X className="size-3" /></button>)}
            <button type="button" onClick={() => onChange({ ...DEFAULT_FILTERS, q: f.q, sort: f.sort, dir: f.dir })} className="underline underline-offset-2 hover:text-text-1">Clear filters</button>
          </>
        )}
      </div>
    </div>
  );
}
