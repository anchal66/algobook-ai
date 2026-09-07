/**
 * Canonical topic vocabulary (Module 04 §3.1 owns the full `TOPIC_META`/`PREREQUISITES`;
 * Module 02 needs the lists now to validate generated tags). Unchanged from v1.
 */
export const CORE_TOPICS = [
  "array", "string", "hash map", "two pointers", "sliding window",
  "stack", "queue", "linked list", "binary search", "sorting",
  "recursion", "tree", "binary tree", "bst", "graph",
  "bfs", "dfs", "dynamic programming", "greedy", "backtracking",
  "heap", "trie", "bit manipulation", "math", "matrix",
] as const;
export type CoreTopic = (typeof CORE_TOPICS)[number];

export const INTERVIEW_PATTERNS = [
  "two pointers", "sliding window", "binary search", "bfs", "dfs",
  "dynamic programming", "backtracking", "stack", "heap", "graph",
  "trie", "greedy", "hash map", "linked list", "tree",
] as const;

/** Common model/LeetCode spellings → canonical topic. */
const TAG_ALIASES: Record<string, CoreTopic> = {
  "arrays": "array", "strings": "string", "hash-map": "hash map", "hashmap": "hash map", "hash table": "hash map", "hash-table": "hash map",
  "hashing": "hash map", "hash set": "hash map", "set": "hash map", "map": "hash map", "two-pointers": "two pointers", "sliding-window": "sliding window",
  "stacks": "stack", "monotonic stack": "stack", "queues": "queue", "deque": "queue", "monotonic queue": "queue", "linked-list": "linked list",
  "linkedlist": "linked list", "binary-search": "binary search", "sort": "sorting", "counting sort": "sorting", "bucket sort": "sorting",
  "trees": "tree", "binary-tree": "binary tree", "binary search tree": "bst", "binary-search-tree": "bst", "graphs": "graph", "union find": "graph",
  "union-find": "graph", "topological sort": "graph", "shortest path": "graph", "breadth-first search": "bfs", "breadth first search": "bfs",
  "depth-first search": "dfs", "depth first search": "dfs", "dp": "dynamic programming", "dynamic-programming": "dynamic programming",
  "memoization": "dynamic programming", "knapsack": "dynamic programming", "priority queue": "heap", "priority-queue": "heap", "heaps": "heap",
  "prefix sum": "array", "prefix-sum": "array", "simulation": "array", "intervals": "sorting", "interval": "sorting", "bit-manipulation": "bit manipulation",
  "bits": "bit manipulation", "bitmask": "bit manipulation", "number theory": "math", "geometry": "math", "combinatorics": "math", "counting": "hash map",
  "grid": "matrix", "2d array": "matrix", "matrices": "matrix", "divide and conquer": "recursion", "divide-and-conquer": "recursion",
  "string matching": "string", "enumeration": "backtracking", "design": "hash map", "ordered set": "bst", "segment tree": "array",
  "binary indexed tree": "array", "sweep line": "sorting", "line sweep": "sorting", "graph traversal": "graph", "tree traversal": "tree",
};

const CORE_SET = new Set<string>(CORE_TOPICS);

/** Lower-cases, maps aliases, drops unknown tags, dedupes. Returns [] when nothing survives. */
export function normalizeTags(tags: string[]): CoreTopic[] {
  const out: CoreTopic[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
    const canon = CORE_SET.has(t) ? (t as CoreTopic) : TAG_ALIASES[t];
    if (canon && !out.includes(canon)) out.push(canon);
  }
  return out;
}

export function isCoreTopic(t: string): t is CoreTopic {
  return CORE_SET.has(t);
}
