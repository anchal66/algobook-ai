import type { Language, Verdict } from "@/lib/data/schema";

export type CaseStatus = Verdict | "IE";

export interface CaseInput {
  input: string;
  /** Omitted for custom test cases — the case cannot fail, only error. */
  expected?: string;
}

export interface CaseResult {
  index: number;
  status: CaseStatus;
  /** true when status is AC or, for expected-less custom cases, when execution succeeded. */
  passed: boolean;
  input: string;
  expected: string | null;
  actual: string;
  stderr: string;
  compileOutput: string | null;
  timeMs: number;
  memoryKb: number;
}

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  failedCase: CaseResult | null;
  runtimeMs: number; // max over cases
  memoryKb: number; // max over cases
  compileOutput: string | null;
  cases: CaseResult[];
  language: Language;
}
