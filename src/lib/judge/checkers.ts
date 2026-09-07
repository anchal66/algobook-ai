import type { Checker } from "@/lib/data/schema";

/** Normalises CRLF, trims trailing whitespace on each line and trailing blank lines. */
export function normalize(s: string): string {
  return s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/g, "")).join("\n").replace(/\n+$/g, "");
}

export function exact(expected: string, actual: string): boolean {
  return normalize(expected) === normalize(actual);
}

export function unorderedLines(expected: string, actual: string): boolean {
  const a = normalize(expected).split("\n").filter((l) => l.length).sort();
  const b = normalize(actual).split("\n").filter((l) => l.length).sort();
  return a.length === b.length && a.every((l, i) => l === b[i]);
}

export function float(expected: string, actual: string, eps = 1e-6): boolean {
  const ea = normalize(expected).split(/\s+/).filter(Boolean);
  const aa = normalize(actual).split(/\s+/).filter(Boolean);
  if (ea.length !== aa.length) return false;
  return ea.every((e, i) => {
    const x = Number(e), y = Number(aa[i]);
    if (Number.isNaN(x) || Number.isNaN(y)) return e === aa[i];
    return Math.abs(x - y) <= eps * Math.max(1, Math.abs(x));
  });
}

export function compare(checker: Checker, expected: string, actual: string): boolean {
  switch (checker.type) {
    case "unordered_lines": return unorderedLines(expected, actual);
    case "float": return float(expected, actual, checker.eps ?? 1e-6);
    default: return exact(expected, actual);
  }
}
