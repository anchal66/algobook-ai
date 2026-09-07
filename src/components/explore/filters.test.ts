import { describe, expect, it } from "vitest";
import { applyFilters, fromSearchParams, toSearchParams, topicCounts, DEFAULT_FILTERS, type StatusMap } from "./filters";
import type { CatalogRow } from "@/lib/app/api";

const row = (o: Partial<CatalogRow>): CatalogRow => ({ id: "a", slug: "a", number: 1, title: "A", difficulty: "Easy", tags: [], companies: [], acceptanceRate: 50, attempts: 0, rating: 1200, languages: ["java"], source: "generated", createdAt: "2026-01-01", ...o });
const rows = [
  row({ id: "1", number: 1, title: "Two Sum", difficulty: "Easy", tags: ["array", "hash-map"], companies: ["google"], acceptanceRate: 80, rating: 1000, createdAt: "2026-01-01" }),
  row({ id: "2", number: 2, title: "Graph Paths", difficulty: "Hard", tags: ["graph", "dfs"], companies: ["meta"], acceptanceRate: 30, rating: 1900, createdAt: "2026-03-01" }),
  row({ id: "3", number: 3, title: "Window Max", difficulty: "Medium", tags: ["array", "sliding-window"], companies: ["google", "amazon"], acceptanceRate: 55, rating: 1500, createdAt: "2026-02-01" }),
];
const statuses: StatusMap = new Map([["1", "solved"], ["3", "attempting"]]);

describe("explore filters", () => {
  it("round-trips through URL params", () => {
    const f = { ...DEFAULT_FILTERS, q: "sum", difficulty: "Hard" as const, status: "todo" as const, topics: ["graph", "dfs"], company: "meta", minRating: 1200, maxRating: 2000, sort: "rating" as const, dir: "desc" as const };
    expect(fromSearchParams(toSearchParams(f))).toEqual(f);
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe("");
  });
  it("filters by difficulty, status, topics (all), company and rating range", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, difficulty: "Hard" }, statuses).map((r) => r.id)).toEqual(["2"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, status: "todo" }, statuses).map((r) => r.id)).toEqual(["2"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, status: "attempting" }, statuses).map((r) => r.id)).toEqual(["3"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, topics: ["array", "hash-map"] }, statuses).map((r) => r.id)).toEqual(["1"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, company: "google" }, statuses).map((r) => r.id)).toEqual(["1", "3"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, minRating: 1400, maxRating: 1600 }, statuses).map((r) => r.id)).toEqual(["3"]);
  });
  it("searches title, slug, tags and #number", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, q: "window" }, statuses).map((r) => r.id)).toEqual(["3"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, q: "#2" }, statuses).map((r) => r.id)).toEqual(["2"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, q: "dfs" }, statuses).map((r) => r.id)).toEqual(["2"]);
  });
  it("sorts by every key in both directions", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "acceptance", dir: "desc" }, statuses).map((r) => r.id)).toEqual(["1", "3", "2"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "difficulty", dir: "asc" }, statuses).map((r) => r.id)).toEqual(["1", "3", "2"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "newest", dir: "asc" }, statuses).map((r) => r.id)).toEqual(["2", "3", "1"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "rating", dir: "desc" }, statuses).map((r) => r.id)).toEqual(["2", "3", "1"]);
  });
  it("counts topics", () => {
    expect(topicCounts(rows)[0]).toEqual({ tag: "array", count: 2 });
  });
});
