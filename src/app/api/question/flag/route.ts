import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const VALID_REASONS = [
  "not-relevant",
  "incomplete-or-broken",
  "runtime-error",
  "wrong-test-cases",
  "other",
] as const;

export async function POST(request: Request) {
  try {
    const { questionId, userId, projectId, reason, details } = await request.json();

    if (!questionId || !userId || !projectId || !reason) {
      return NextResponse.json(
        { error: "questionId, userId, projectId, and reason are required" },
        { status: 400 },
      );
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    const questionRef = adminDb.collection("questions").doc(questionId);
    const snap = await questionRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // 1. Flag the question globally so it's excluded from the curated pool
    await questionRef.update({
      flagged: true,
      flaggedBy: userId,
      flaggedAt: new Date().toISOString(),
      flagReason: reason,
      flagDetails: details || null,
    });

    // 2. Remove the question from this project's question list
    const projectQuestionRef = adminDb
      .collection("projects")
      .doc(projectId)
      .collection("projectQuestions")
      .doc(questionId);
    const pqSnap = await projectQuestionRef.get();
    if (pqSnap.exists) {
      await projectQuestionRef.delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Flag question error:", error);
    return NextResponse.json({ error: "Failed to flag question" }, { status: 500 });
  }
}
