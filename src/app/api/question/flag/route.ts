import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { questionId, userId, reason } = await request.json();

    if (!questionId || !userId) {
      return NextResponse.json({ error: "questionId and userId are required" }, { status: 400 });
    }

    const questionRef = adminDb.collection("questions").doc(questionId);
    const snap = await questionRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Mark the question as flagged so it's excluded from the curated pool
    await questionRef.update({
      flagged: true,
      flaggedBy: userId,
      flaggedAt: new Date().toISOString(),
      flagReason: reason || "runtime-error",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Flag question error:", error);
    return NextResponse.json({ error: "Failed to flag question" }, { status: 500 });
  }
}
