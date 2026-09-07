import type { Language } from "@/lib/data/schema";

const JAVA_IMPORT_RE = /^\s*import\s+[\w.*]+\s*;\s*$/gm;

/** Java: Judge0 compiles Main.java → one public class. Merge imports, strip `public` from non-Main classes (ported from v1). */
export function assembleJava(userCode: string, driverCode: string): string {
  const userImports = userCode.match(JAVA_IMPORT_RE) ?? [];
  const driverImports = driverCode.match(JAVA_IMPORT_RE) ?? [];
  const user = userCode.replace(JAVA_IMPORT_RE, "").replace(/public\s+(?=(?:final\s+|abstract\s+)*(?:class|interface|enum|record)\s+(?!Main\b)\w+)/g, "").trim();
  const driver = driverCode.replace(JAVA_IMPORT_RE, "").trim();
  const imports = [...new Set([...JAVA_IMPLICIT_IMPORTS, ...userImports, ...driverImports].map((s) => s.trim()))];
  return `${imports.join("\n")}\n\n// ---- user code ----\n${user}\n\n// ---- driver ----\n${driver}\n`;
}

const CPP_PRELUDE = `#include <bits/stdc++.h>\nusing namespace std;\n`;
/** LeetCode pre-imports these in its Python runtime; users (and the AI) rely on it. */
const PYTHON_PRELUDE = `from typing import List, Dict, Set, Tuple, Optional, Deque, DefaultDict, Any\nimport sys, math, bisect, heapq, itertools, functools, collections, string, re\nfrom collections import defaultdict, deque, Counter, OrderedDict\nfrom functools import lru_cache, reduce\nfrom heapq import heappush, heappop, heapify\nfrom itertools import permutations, combinations, accumulate, product\nfrom bisect import bisect_left, bisect_right\nfrom math import inf, gcd, sqrt, ceil, floor, log2\nsys.setrecursionlimit(10000)\n`;
/** Java: LeetCode implicitly imports java.util.*. */
const JAVA_IMPLICIT_IMPORTS = ["import java.util.*;", "import java.io.*;", "import java.util.stream.*;"];

/** Builds the full program that Judge0 runs for a language. */
export function assemble(language: Language, userCode: string, driverCode: string): string {
  switch (language) {
    case "java":
      return assembleJava(userCode, driverCode);
    case "python":
      return `${PYTHON_PRELUDE}\n${userCode.replace(/\r\n/g, "\n")}\n\n# ---- driver ----\n${driverCode}\n`;
    case "cpp": {
      const hasPrelude = /#include\s*<bits\/stdc\+\+\.h>/.test(userCode);
      return `${hasPrelude ? "" : CPP_PRELUDE}${userCode}\n\n// ---- driver ----\n${driverCode}\n`;
    }
    case "javascript":
      return `${userCode}\n\n// ---- driver ----\n${driverCode}\n`;
  }
}
