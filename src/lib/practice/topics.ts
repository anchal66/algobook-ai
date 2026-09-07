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

/** Topics mentioned anywhere in free text (canonical names and aliases, longest match first). */
export function topicsInText(text: string, max = 3): CoreTopic[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ")} `;
  const out: CoreTopic[] = [];
  const names: [string, CoreTopic][] = [...CORE_TOPICS.map((c) => [c, c] as [string, CoreTopic]), ...Object.entries(TAG_ALIASES)];
  names.sort((a, b) => b[0].length - a[0].length);
  for (const [name, canon] of names) {
    if (out.length >= max) break;
    if (t.includes(` ${name} `) && !out.includes(canon)) out.push(canon);
  }
  return out;
}

// ── Module 04 §3.1: prerequisite DAG + display metadata ──────────────────────

/**
 * topic → prerequisites that should be learned first. v1 map plus
 * `heap: [array]`, `matrix: [array]`, `bit manipulation: [math]` (spec §3.1).
 * Only strong pedagogical dependencies; shallow (max depth 4) so redirect chains stay short.
 */
export const PREREQUISITES: Readonly<Partial<Record<CoreTopic, readonly CoreTopic[]>>> = {
  "dynamic programming": ["recursion", "array"],
  "graph": ["array"],
  "bfs": ["graph", "queue"],
  "dfs": ["graph", "stack", "recursion"],
  "trie": ["string", "tree"],
  "bst": ["binary tree", "sorting"],
  "binary tree": ["tree"],
  "tree": ["recursion"],
  "binary search": ["array", "sorting"],
  "backtracking": ["recursion"],
  "heap": ["array"],
  "sliding window": ["array", "two pointers"],
  "linked list": ["array"],
  "two pointers": ["array"],
  "stack": ["array"],
  "queue": ["array"],
  "matrix": ["array"],
  "bit manipulation": ["math"],
};

export interface TopicMeta { name: string; icon: string; description: string }

/** Display names, lucide icon names and one-liners for the skill tree (Module 05 renders them). */
export const TOPIC_META: Readonly<Record<CoreTopic, TopicMeta>> = {
  "array": { name: "Arrays", icon: "Brackets", description: "Indexing, prefix sums, in-place tricks — the foundation of everything else." },
  "string": { name: "Strings", icon: "Type", description: "Parsing, palindromes, anagrams and character counting." },
  "hash map": { name: "Hash Maps", icon: "Hash", description: "O(1) lookups: frequency counting, grouping and de-duplication." },
  "two pointers": { name: "Two Pointers", icon: "MoveHorizontal", description: "Converging or fast/slow pointers over sorted or linear data." },
  "sliding window": { name: "Sliding Window", icon: "PanelLeftOpen", description: "Best subarray or substring under a constraint in one pass." },
  "stack": { name: "Stacks", icon: "Layers", description: "LIFO processing: parentheses, monotonic stacks, expression evaluation." },
  "queue": { name: "Queues", icon: "ListOrdered", description: "FIFO processing, deques and level-by-level traversal." },
  "linked list": { name: "Linked Lists", icon: "Link", description: "Pointer manipulation, reversal, cycle detection and merging." },
  "binary search": { name: "Binary Search", icon: "Search", description: "Halving the search space on sorted data or on the answer itself." },
  "sorting": { name: "Sorting", icon: "ArrowDownWideNarrow", description: "Comparison sorts, custom comparators, intervals and sweep lines." },
  "recursion": { name: "Recursion", icon: "Repeat", description: "Self-similar decomposition, divide and conquer, base cases." },
  "tree": { name: "Trees", icon: "Network", description: "Hierarchical data: traversal orders, depth, ancestors and paths." },
  "binary tree": { name: "Binary Trees", icon: "GitBranch", description: "Recursive structure, BFS/DFS on nodes, serialization." },
  "bst": { name: "Binary Search Trees", icon: "GitFork", description: "Ordered trees: in-order traversal, validation, kth element." },
  "graph": { name: "Graphs", icon: "Share2", description: "Adjacency lists, components, union-find and topological order." },
  "bfs": { name: "BFS", icon: "Waves", description: "Shortest paths in unweighted graphs and grids, multi-source BFS." },
  "dfs": { name: "DFS", icon: "CornerDownRight", description: "Explore-and-backtrack over graphs and grids, cycle detection." },
  "dynamic programming": { name: "Dynamic Programming", icon: "Grid3x3", description: "Overlapping subproblems: memoization, tabulation, state design." },
  "greedy": { name: "Greedy", icon: "Zap", description: "Locally optimal choices that stay globally optimal." },
  "backtracking": { name: "Backtracking", icon: "Undo2", description: "Permutations, combinations, subsets and constraint search." },
  "heap": { name: "Heaps", icon: "Mountain", description: "Priority queues: top-k, k-way merge, running medians." },
  "trie": { name: "Tries", icon: "TextCursorInput", description: "Prefix trees for word search, autocomplete and XOR tricks." },
  "bit manipulation": { name: "Bit Manipulation", icon: "Binary", description: "Masks, XOR properties, counting bits and subsets by bitmask." },
  "math": { name: "Math", icon: "Sigma", description: "Number theory, modular arithmetic, geometry and combinatorics." },
  "matrix": { name: "Matrices", icon: "Table", description: "2D grids: traversal, rotation, spiral order and grid DP." },
};

export function getPrerequisites(topic: string): CoreTopic[] {
  const key = topic.toLowerCase() as CoreTopic;
  return [...(PREREQUISITES[key] ?? [])];
}

/** Depth in the prerequisite DAG (0 = no prerequisites). Cycle-safe. */
export function getTopicDepth(topic: string, visited: Set<string> = new Set()): number {
  const key = topic.toLowerCase();
  const prereqs = PREREQUISITES[key as CoreTopic];
  if (!prereqs?.length) return 0;
  if (visited.has(key)) return 0;
  visited.add(key);
  let max = 0;
  for (const p of prereqs) max = Math.max(max, getTopicDepth(p, visited) + 1);
  return max;
}

/** Every core topic, prerequisites first (stable within a depth level). */
export function getTopologicalOrder(): CoreTopic[] {
  return [...CORE_TOPICS].sort((a, b) => getTopicDepth(a) - getTopicDepth(b) || CORE_TOPICS.indexOf(a) - CORE_TOPICS.indexOf(b));
}

/** Throws when the prerequisite map contains a cycle or an unknown topic (guarded by a unit test). */
export function assertPrerequisitesAcyclic(): void {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const visit = (t: string, path: string[]) => {
    if (!CORE_SET.has(t)) throw new Error(`PREREQUISITES references unknown topic "${t}"`);
    const c = color.get(t) ?? WHITE;
    if (c === GREY) throw new Error(`PREREQUISITES cycle: ${[...path, t].join(" → ")}`);
    if (c === BLACK) return;
    color.set(t, GREY);
    for (const p of PREREQUISITES[t as CoreTopic] ?? []) visit(p, [...path, t]);
    color.set(t, BLACK);
  };
  for (const t of CORE_TOPICS) visit(t, []);
}

/** "easy" / "medium" / "hard" mentioned in free text, if any. */
export function difficultyInText(text: string): "Easy" | "Medium" | "Hard" | null {
  const t = text.toLowerCase();
  if (/\bhard\b/.test(t)) return "Hard";
  if (/\bmedium\b/.test(t)) return "Medium";
  if (/\beasy\b/.test(t)) return "Easy";
  return null;
}
