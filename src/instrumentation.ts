/** Validates the server environment at cold start (instead of on the first request) so a misconfigured deploy fails loudly. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("@/lib/env");
    void env.NODE_ENV;
    if (env.isProd && !env.CRON_SECRET) console.warn(JSON.stringify({ evt: "env.warn", message: "CRON_SECRET is unset — daily challenge / leaderboard / pregen crons will be rejected" }));
  }
}
