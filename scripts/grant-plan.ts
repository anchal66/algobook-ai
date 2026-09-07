/**
 * Manually grants a Pro plan (after the wipe, or for testing Pro flows).
 *   npm run db:grant-plan -- --uid <uid> --plan pro-yearly --days 365
 */
import { Timestamp } from "firebase-admin/firestore";
import { args } from "./_bootstrap";
import { getPlan } from "../src/lib/plans";
import { createSubscription } from "../src/lib/data/subscriptions";
import { setPlanCache } from "../src/lib/data/users";

async function main() {
  const a = args();
  const uid = String(a.uid ?? "");
  const planSlug = String(a.plan ?? "pro-yearly");
  const plan = getPlan(planSlug);
  if (!uid || !plan) throw new Error("usage: --uid <uid> --plan pro-monthly|pro-yearly [--days N]");
  const days = a.days ? parseInt(String(a.days), 10) : plan.durationDays;
  const sub = await createSubscription({
    uid, planSlug: plan.slug, planName: plan.name, durationDays: days,
    gatewayTransactionId: `manual_${Date.now()}`, amountPaid: 0, currency: plan.currency,
  });
  await setPlanCache(uid, { slug: "pro", planSlug: plan.slug, status: "active", endDate: sub.endDate, checkedAt: Timestamp.now() }).catch(() => undefined);
  console.log(`Granted ${plan.name} to ${uid} until ${sub.endDate.toDate().toISOString()} (subscription ${sub.id})`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
