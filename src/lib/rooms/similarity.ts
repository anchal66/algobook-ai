/**
 * Code similarity (Module 06 §3.9): normalised tokens → k-gram hashes → winnowing fingerprints → containment
 * score. Renaming variables, re-ordering functions or re-formatting does not hide a copy; unrelated solutions
 * to the same problem score low. Pure.
 */
import type { Language } from "@/lib/data/schema";

const KEYWORDS: Record<Language, Set<string>> = {
  java: new Set(["class", "public", "private", "static", "void", "int", "long", "double", "boolean", "char", "String", "new", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "true", "false", "null", "this", "final", "import", "Map", "HashMap", "List", "ArrayList", "Set", "HashSet", "Integer", "Arrays", "Collections", "length", "size", "get", "put", "add", "containsKey", "contains"]),
  python: new Set(["def", "class", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "is", "None", "True", "False", "import", "from", "as", "with", "try", "except", "lambda", "yield", "break", "continue", "pass", "len", "range", "enumerate", "dict", "list", "set", "sorted", "min", "max", "sum", "append", "pop", "self"]),
  cpp: new Set(["int", "long", "double", "bool", "char", "void", "auto", "const", "class", "struct", "public", "private", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "true", "false", "nullptr", "new", "delete", "vector", "string", "map", "unordered_map", "set", "unordered_set", "pair", "size", "push_back", "begin", "end", "find", "std", "using", "namespace", "include"]),
  javascript: new Set(["var", "let", "const", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "true", "false", "null", "undefined", "new", "this", "class", "of", "in", "typeof", "Map", "Set", "Array", "length", "push", "pop", "get", "set", "has", "Math"]),
};

/** Normalises code to a token stream: comments and strings removed, identifiers → ID, numbers → N. */
export function tokenize(code: string, language: Language): string[] {
  let src = code;
  const STR = " \u00a7 ";
  if (language === "python") src = src.replace(/#.*$/gm, " ").replace(/("""|''')[\s\S]*?\1/g, STR);
  else src = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
  src = src.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, STR);
  const kw = KEYWORDS[language];
  const out: string[] = [];
  const re = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|->|=>|::|[^\s\w]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const t = m[0];
    if (t === "\u00a7") out.push("S");
    else if (/^\d/.test(t)) out.push("N");
    else if (/^[A-Za-z_$]/.test(t)) out.push(kw.has(t) ? t : "ID");
    else out.push(t);
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Winnowing (Schleimer et al.): the minimum hash of every window of `w` consecutive k-grams. */
export function fingerprints(tokens: string[], k = 5, w = 4): Set<number> {
  const grams: number[] = [];
  for (let i = 0; i + k <= tokens.length; i++) grams.push(hash(tokens.slice(i, i + k).join(" ")));
  const out = new Set<number>();
  if (!grams.length) return out;
  if (grams.length <= w) { out.add(Math.min(...grams)); return out; }
  for (let i = 0; i + w <= grams.length; i++) out.add(Math.min(...grams.slice(i, i + w)));
  return out;
}

/** Containment of the smaller fingerprint set in the larger one, 0..1. */
export function similarity(a: Set<number>, b: Set<number>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const f of small) if (large.has(f)) shared++;
  return shared / small.size;
}

export function codeSimilarity(codeA: string, codeB: string, language: Language): number {
  const ta = tokenize(codeA, language), tb = tokenize(codeB, language);
  if (ta.length < 12 || tb.length < 12) return 0; // too short to mean anything
  return similarity(fingerprints(ta), fingerprints(tb));
}

export interface SimilarityCandidate { uid: string; problemId: string; language: Language; code: string; at: number }
export interface SimilarityFlag { problemId: string; a: string; b: string; score: number; level: "flag" | "strong"; /** uid of the later submitter when the earlier one is exonerated */ later: string | null }

export const SIMILARITY_FLAG = 0.8;
export const SIMILARITY_STRONG = 0.95;

/**
 * Pairwise check of accepted submissions per problem (same language only — cross-language copies are
 * out of scope), plus each against the reference solutions. When one submission is ≥ 10 minutes earlier,
 * only the later one is flagged.
 */
export function pairwiseSimilarity(subs: SimilarityCandidate[], references: Partial<Record<Language, string>> = {}): SimilarityFlag[] {
  const flags: SimilarityFlag[] = [];
  const byProblem = new Map<string, SimilarityCandidate[]>();
  for (const s of subs) (byProblem.get(s.problemId) ?? byProblem.set(s.problemId, []).get(s.problemId)!).push(s);
  for (const [problemId, list] of byProblem) {
    const fps = list.map((s) => ({ s, fp: fingerprints(tokenize(s.code, s.language)), len: tokenize(s.code, s.language).length }));
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const A = fps[i], B = fps[j];
        if (A.s.uid === B.s.uid || A.s.language !== B.s.language || A.len < 12 || B.len < 12) continue;
        const score = similarity(A.fp, B.fp);
        if (score < SIMILARITY_FLAG) continue;
        const gap = Math.abs(A.s.at - B.s.at);
        const later = gap >= 10 * 60_000 ? (A.s.at > B.s.at ? A.s.uid : B.s.uid) : null;
        flags.push({ problemId, a: A.s.uid, b: B.s.uid, score: Math.round(score * 1000) / 1000, level: score >= SIMILARITY_STRONG ? "strong" : "flag", later });
      }
      const cur = fps[i];
      const ref = references[cur.s.language];
      if (ref && cur.len >= 12) {
        const score = similarity(cur.fp, fingerprints(tokenize(ref, cur.s.language)));
        if (score >= SIMILARITY_FLAG) flags.push({ problemId, a: cur.s.uid, b: "reference", score: Math.round(score * 1000) / 1000, level: score >= SIMILARITY_STRONG ? "strong" : "flag", later: cur.s.uid });
      }
    }
  }
  return flags;
}
