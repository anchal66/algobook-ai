import { handler } from "@/lib/api/handler";
import { budgetStatus } from "@/lib/judge/budget";

/** Public (signed-in) view of today's judge budget for the room wizard (numbers only). */
export const GET = handler({ evt: "judge.budget" }, async () => {
  const b = await budgetStatus();
  return { remaining: Number.isFinite(b.remaining) ? b.remaining : null, cap: b.cap, reserve: b.reserve, date: b.date };
});
