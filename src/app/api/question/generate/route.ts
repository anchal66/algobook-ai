import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getOrCreateProfile } from "@/lib/user-profile";
import { recommend, recommendFromTemplate } from "@/lib/recommendation";
import { getOrGenerateQuestion, linkQuestionToProject } from "@/lib/question-generator";
import { computePracticeState } from "@/lib/practice-engine";
import { checkSubscription } from "@/lib/check-subscription";
import type { TemplatePoolEntry } from "@/types";

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

    const userPrompt = prompt === "__auto_next__" ? undefined : prompt;
    const templateId = projectData.templateId as string | undefined;

    // ── 2. TEMPLATE-AWARE vs NORMAL RECOMMENDATION ──

    let recommendation;
    let templateEntry: (TemplatePoolEntry & { docId: string }) | undefined;
    let isTemplateExhausted = false;

    if (templateId) {
      // Fetch pending template pool entries
      const poolSnap = await adminDb
        .collection("projects")
        .doc(projectId)
        .collection("templatePool")
        .where("status", "==", "pending")
        .get();

      const pendingPool = poolSnap.docs.map((d) => ({
        ...(d.data() as TemplatePoolEntry),
        docId: d.id,
      }));

      if (pendingPool.length > 0) {
        const templateRec = recommendFromTemplate(profile, pendingPool, existingQuestions, userPrompt);
        if (templateRec) {
          recommendation = templateRec;
          templateEntry = templateRec.selectedEntry as (TemplatePoolEntry & { docId: string });
        }
      } else {
        isTemplateExhausted = true;
      }
    }

    // Fall back to normal recommendation if no template or pool exhausted
    if (!recommendation) {
      recommendation = recommend(profile, existingQuestions, userPrompt);

      // If template exhausted, annotate the reason
      if (isTemplateExhausted) {
        recommendation.reason = {
          short: "Template complete",
          detail: "All template questions have been covered! Continuing with AI-generated questions based on your performance.",
        };
      }
    }

    const resolvedPrompt = recommendation.promptOverride
      || userPrompt
      || (templateEntry
        ? `Give me a ${recommendation.difficulty.toLowerCase()} question inspired by "${templateEntry.title}".`
        : `Give me a ${recommendation.difficulty.toLowerCase()} question on ${recommendation.suggestedTopics.join(" or ")}.`);

    // ── 3. GET OR GENERATE QUESTION ──

    const result = await getOrGenerateQuestion({
      profile,
      recommendation,
      existingIds,
      existingTitles,
      projectDescription: projectData.description || "",
      projectPurpose: projectData.purpose || "",
      userPrompt: resolvedPrompt,
      templateEntry: templateEntry || undefined,
    });

    // ── 4. LINK TO PROJECT ──

    await linkQuestionToProject(projectId, result.question, result.reason);

    // ── 5. MARK TEMPLATE ENTRY AS USED ──

    if (templateEntry && result.question.id) {
      await adminDb
        .collection("projects")
        .doc(projectId)
        .collection("templatePool")
        .doc(templateEntry.docId)
        .update({
          status: "used",
          linkedQuestionId: result.question.id,
        });
    }

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
