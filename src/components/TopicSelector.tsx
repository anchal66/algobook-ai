"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, ChevronDown } from "lucide-react";

const ALL_TOPICS = [
  "array", "string", "hash map", "two pointers", "sliding window",
  "stack", "queue", "linked list", "binary search", "sorting",
  "recursion", "tree", "binary tree", "bst", "graph",
  "bfs", "dfs", "dynamic programming", "greedy", "backtracking",
  "heap", "trie", "bit manipulation", "math", "matrix",
];

interface TopicSelectorProps {
  selected: string[];
  onChange: (topics: string[]) => void;
  placeholder?: string;
  compact?: boolean; // smaller variant for editor
}

export default function TopicSelector({ selected, onChange, placeholder = "Filter by topics (optional)", compact = false }: TopicSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = ALL_TOPICS.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTopic = (topic: string) => {
    if (selected.includes(topic)) {
      onChange(selected.filter((t) => t !== topic));
    } else {
      onChange([...selected, topic]);
    }
  };

  const removeTopic = (topic: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((t) => t !== topic));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 rounded-lg border border-border/60 bg-background text-left transition-colors hover:border-primary/40 ${
          compact ? "px-2.5 py-1.5 min-h-[32px]" : "px-3 py-2.5 min-h-[44px]"
        } ${open ? "border-primary/60 ring-1 ring-primary/20" : ""}`}
      >
        <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
          {selected.length === 0 ? (
            <span className={`text-muted-foreground ${compact ? "text-[11px]" : "text-sm"}`}>{placeholder}</span>
          ) : (
            <>
              {selected.slice(0, compact ? 2 : 4).map((topic) => (
                <span
                  key={topic}
                  className={`inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary border border-primary/15 font-medium capitalize ${
                    compact ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"
                  }`}
                >
                  {topic}
                  <button
                    type="button"
                    onClick={(e) => removeTopic(topic, e)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
                  </button>
                </span>
              ))}
              {selected.length > (compact ? 2 : 4) && (
                <span className={`text-muted-foreground ${compact ? "text-[10px]" : "text-[11px]"}`}>
                  +{selected.length - (compact ? 2 : 4)} more
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-muted-foreground hover:text-red-400 transition-colors"
            >
              <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            </button>
          )}
          <ChevronDown className={`text-muted-foreground transition-transform ${compact ? "h-3 w-3" : "h-3.5 w-3.5"} ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-50 mt-1 w-full rounded-lg border border-border/60 bg-card shadow-xl ${compact ? "max-h-[240px]" : "max-h-[280px]"}`}>
          {/* Search */}
          <div className="p-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-7 pr-2 bg-background rounded-md border border-border/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 ${
                  compact ? "py-1 text-[11px]" : "py-1.5 text-xs"
                }`}
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto p-1.5" style={{ maxHeight: compact ? "190px" : "220px" }}>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No topics match &quot;{search}&quot;</p>
            ) : (
              <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} gap-1`}>
                {filtered.map((topic) => {
                  const isSelected = selected.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "hover:bg-muted/50 text-foreground border border-transparent"
                      }`}
                    >
                      <div className={`shrink-0 rounded-sm border transition-colors ${
                        compact ? "h-3 w-3" : "h-3.5 w-3.5"
                      } flex items-center justify-center ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && (
                          <svg className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`capitalize truncate ${compact ? "text-[10px]" : "text-[11px]"} font-medium`}>{topic}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="border-t border-border/40 px-2.5 py-1.5 flex items-center justify-between">
              <span className={`text-muted-foreground ${compact ? "text-[10px]" : "text-[11px]"}`}>{selected.length} selected</span>
              <button
                type="button"
                onClick={clearAll}
                className={`text-red-400 hover:text-red-300 transition-colors font-medium ${compact ? "text-[10px]" : "text-[11px]"}`}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
