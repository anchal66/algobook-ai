/**
 * Judge0 budget mode (Module 06 §3.12): estimates how many judge batches a room will need and whether
 * today's remaining budget can afford it. Pure; the routes pass in the live numbers.
 */
export interface BudgetEstimate { need: number; likely: number }

/** Worst case = every member exhausts both caps; likely ≈ 2.2 executions per member per problem (measured later). */
export function estimateBatches(members: number, problems: number, caps: { maxSubmitsPerProblem: number; maxRunsPerProblem: number }): BudgetEstimate {
  const m = Math.max(0, members), p = Math.max(0, problems);
  return { need: m * p * (caps.maxSubmitsPerProblem + caps.maxRunsPerProblem), likely: Math.ceil(m * p * 2.2) };
}

export type BudgetLevel = "ok" | "tight" | "over" | "unlimited";

export function budgetLevel(est: BudgetEstimate, remaining: number, cap: number): BudgetLevel {
  if (cap === 0 || !Number.isFinite(remaining)) return "unlimited";
  if (est.need > remaining) return "over";
  if (est.likely > remaining * 0.5) return "tight";
  return "ok";
}

/** Start guard: refuse when the likely usage does not fit in what is left after the user reserve. */
export function canStart(est: BudgetEstimate, remaining: number, cap: number, reserve: number): { ok: boolean; reason?: string } {
  if (cap === 0 || !Number.isFinite(remaining)) return { ok: true };
  const available = Math.max(0, remaining - reserve);
  if (est.likely > available) return { ok: false, reason: `This room will likely need ${est.likely} code executions but only ${available} are available today. Lower the participants, problems or per-problem caps, or try tomorrow.` };
  return { ok: true };
}
