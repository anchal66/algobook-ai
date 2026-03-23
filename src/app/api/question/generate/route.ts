import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getOrCreateProfile } from "@/lib/user-profile";
import { recommend } from "@/lib/recommendation";
import { getOrGenerateQuestion, linkQuestionToProject } from "@/lib/question-generator";
import { computePracticeState } from "@/lib/practice-engine";
import { checkSubscription } from "@/lib/check-subscription";

export async function POST(request: Request) {
  try {
    const { prompt, projectId, userId } = await request.json();

    if (!prompt || !projectId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sub = await checkSubscription(userId);
    if (!sub.active) {
      return NextResponse.json(
        { error: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      );
    }

    // ── 1. GATHER CONTEXT ──

    const [projectSnap, projectQuestionsSnap, profile] = await Promise.all([
      adminDb.collection("projects").doc(projectId).get(),
      adminDb.collection("projects").doc(projectId).collection("projectQuestions").get(),
      getOrCreateProfile(userId),
    ]);

    const projectData = projectSnap.exists ? projectSnap.data()! : {};

    // Sync practice state
    const practiceState = computePracticeState(profile);
    if (practiceState !== profile.practiceState) {
      profile.practiceState = practiceState;
      await adminDb.collection("userProfiles").doc(userId).update({ practiceState });
    }

    const existingQuestions = projectQuestionsSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, title: data.title, tags: data.tags || [], difficulty: data.difficulty };
    });
    const existingIds = new Set(existingQuestions.map((q) => q.id));
    const existingTitles = existingQuestions.map(
      (q) => `${q.title} (${(q.tags || []).join(", ")}, ${q.difficulty})`
    );

    // ── 2. RECOMMEND ──

    const userPrompt = prompt === "__auto_next__" ? undefined : prompt;
    const recommendation = recommend(profile, existingQuestions, userPrompt);

    const resolvedPrompt = recommendation.promptOverride
      || userPrompt
      || `Give me a ${recommendation.difficulty.toLowerCase()} question on ${recommendation.suggestedTopics.join(" or ")}.`;

    // ── 3. GET OR GENERATE QUESTION ──

    const result = await getOrGenerateQuestion({
      profile,
      recommendation,
      existingIds,
      existingTitles,
      projectDescription: projectData.description || "",
      projectPurpose: projectData.purpose || "",
      userPrompt: resolvedPrompt,
    });

    // ── 4. LINK TO PROJECT ──

    await linkQuestionToProject(projectId, result.question, result.reason);

    return NextResponse.json({
      question: result.question,
      reason: result.reason,
      source: result.source,
    });
  } catch (error) {
    console.error("Error in generate question API:", error);
    return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
  }
}
