import { handler } from "@/lib/api/handler";
import { budgetStatus } from "@/lib/judge/budget";
import { env } from "@/lib/env";

/** `GET /api/admin/judge` — today's judge batch budget (D-05). Counted locally, so it costs no quota to read. */
export const GET = handler({ evt: "admin.judge", admin: true }, async () => {
  const s = await budgetStatus();
  const selfHosted = !!env.JUDGE0_AUTH_TOKEN || !/rapidapi/.test(env.JUDGE0_HOST_HEADER ?? "");
  return {
    ...s,
    remaining: Number.isFinite(s.remaining) ? s.remaining : null,
    backgroundRemaining: Number.isFinite(s.backgroundRemaining) ? s.backgroundRemaining : null,
    selfHosted,
    backend: env.JUDGE_BACKEND,
    host: env.JUDGE0_BASE_URL,
  };
});
