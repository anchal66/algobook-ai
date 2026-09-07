import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";

/** `POST /api/contact` (Module 05 U-21): stores a contact-form message in `contactMessages`. Public; 5 per hour per IP. */
const Body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(10).max(4000),
  /** Honeypot — bots fill it, humans never see it. */
  website: z.string().max(0).optional(),
});

export const POST = handler({ evt: "contact.send", body: Body, auth: "optional" }, async ({ req, body, user }) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const since = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const recent = await adminDb.collection("contactMessages").where("ip", "==", ip).where("createdAt", ">", since).count().get();
  if (recent.data().count >= 5) throw ApiError.quotaExceeded(new Date(Date.now() + 3600_000).toISOString(), "Too many messages — please try again in an hour.");
  await adminDb.collection("contactMessages").add({
    name: body.name, email: body.email, subject: body.subject, message: body.message,
    uid: user?.uid ?? null, ip, userAgent: req.headers.get("user-agent") ?? "", status: "new", createdAt: Timestamp.now(),
  });
  return { ok: true as const };
});
