import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Question, UserProfile, QuestionWithReason, RecommendationReason } from "@/types";
import { buildPerformanceSummary } from "@/lib/user-profile";
import { findPrerequisiteGaps } from "@/lib/prerequisite-graph";
import type { Recommendation } from "@/lib/recommendation";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GenerationContext {
  profile: UserProfile;
  recommendation: Recommendation;
  existingIds: Set<string>;
  existingTitles: string[];
  projectDescription: string;
  projectPurpose: string;
  userPrompt: string;
}

/**
 * Three-tier question sourcing:
 *   1. Search curated pool (Firestore) → match topic + difficulty, exclude already-used
 *   2. If found, return as-is (fast, high quality, no API cost)
 *   3. If not found, generate via GPT-4o (expensive, but fully tailored)
 */
export async function getOrGenerateQuestion(
  ctx: GenerationContext
): Promise<QuestionWithReason> {
  const { recommendation } = ctx;

  // ── TIER 1: CURATED POOL SEARCH ──
  const curated = await searchCuratedPool(ctx);
  if (curated) {
    return {
      question: curated,
      reason: recommendation.reason,
      source: "curated",
    };
  }

  // ── TIER 2: AI GENERATION ──
  const generated = await generateWithAI(ctx);
  return {
    question: generated,
    reason: recommendation.reason,
    source: "generated",
  };
}

async function searchCuratedPool(ctx: GenerationContext): Promise<Question | null> {
  const { recommendation, existingIds } = ctx;
  const topics = recommendation.suggestedTopics;

  if (topics.length === 0) return null;

  const tagsToSearch = topics.slice(0, 10);

  try {
    const snapshot = await adminDb
      .collection("questions")
      .where("tags", "array-contains-any", tagsToSearch)
      .limit(20)
      .get();

    const candidates = snapshot.docs.filter((d) => !existingIds.has(d.id));

    if (candidates.length === 0) return null;

    // Prefer matching difficulty, then random
    const diffMatches = candidates.filter(
      (d) => d.data().difficulty === recommendation.difficulty
    );
    const pool = diffMatches.length > 0 ? diffMatches : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    return { id: pick.id, ...pick.data() } as Question;
  } catch (err) {
    console.error("Curated pool search failed:", err);
    return null;
  }
}

async function generateWithAI(ctx: GenerationContext): Promise<Question> {
  const { profile, recommendation, existingTitles, projectDescription, projectPurpose, userPrompt } = ctx;

  const performanceSummary = buildPerformanceSummary(profile);

  const goalDescriptions: Record<string, string> = {
    "learn-basics": "learning programming fundamentals for the first time",
    "daily-practice": "daily coding practice to stay sharp",
    "interview-prep": "preparing for technical interviews at top companies",
    "returning-after-break": "returning to coding after a long break, needs confidence-building questions",
  };

  const experienceGuidance: Record<string, string> = {
    beginner: "Use simple language, provide more detailed examples, and avoid advanced concepts. Focus on fundamental data structures and basic algorithms.",
    intermediate: "Assume familiarity with common data structures. Balance between standard patterns and slight variations.",
    advanced: "You may use advanced concepts, complex constraints, and multi-step solutions. Assume strong CS fundamentals.",
  };

  const topicDirective = recommendation.suggestedTopics.length > 0
    ? `FOCUS TOPICS: ${recommendation.suggestedTopics.join(", ")}`
    : "";

  const avoidDirective = recommendation.avoidTopics.length > 0
    ? `AVOID THESE TOPICS (user practiced them recently): ${recommendation.avoidTopics.join(", ")}`
    : "";

  // Prerequisite context: tell AI about gaps so it can bridge topics
  const primaryTopic = recommendation.suggestedTopics[0] || "";
  const prereqGaps = primaryTopic ? findPrerequisiteGaps(profile, primaryTopic) : [];
  const prereqDirective = prereqGaps.length > 0
    ? `PREREQUISITE GAPS: User has weak prerequisites for "${primaryTopic}": ${prereqGaps.map((g) => `${g.topic} (mastery: ${Math.round(g.currentMastery)}%)`).join(", ")}. Design the problem to bridge from these foundational concepts toward the target topic.`
    : "";

  // Time/struggle context: inform AI about the user's speed tendencies
  const topicSkill = profile.topicSkills?.[primaryTopic.toLowerCase()];
  const timeContext = topicSkill
    ? `TIME PERFORMANCE ON "${primaryTopic}": avg solve time ${topicSkill.avgTimeSeconds}s, speed factor ${(topicSkill.timeEfficiency || 1.0).toFixed(2)}x (1.0=expected, <1=slow, >1=fast). Avg runs before submit: ${topicSkill.totalRunCount && topicSkill.solved ? Math.round(topicSkill.totalRunCount / topicSkill.solved) : "N/A"}.`
    : "";

  const systemPrompt = `You are an expert programming challenge creator for a personalized coding practice platform.

USER CONTEXT:
- Experience level: ${profile.experienceLevel}
- Goal: ${goalDescriptions[profile.goalType] || profile.goalType}
- Practice state: ${profile.practiceState}
- Project: "${projectDescription}"${projectPurpose ? ` / Purpose: "${projectPurpose}"` : ""}

PERFORMANCE DATA:
${performanceSummary}
${timeContext}

ALREADY SOLVED IN THIS PROJECT (do NOT repeat these or generate very similar problems):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "None yet (first question)"}

RECOMMENDATION:
- Difficulty: ${recommendation.difficulty}
${topicDirective}
${avoidDirective}
${prereqDirective}
- Reason: ${recommendation.reason.detail}

EXPERIENCE GUIDANCE: ${experienceGuidance[profile.experienceLevel] || experienceGuidance.intermediate}

${recommendation.isCalibration ? "CALIBRATION MODE: This is a calibration question for a returning user. Keep it straightforward to assess their current level." : ""}

The user's request: "${userPrompt}"

Generate a UNIQUE coding challenge. Respond with a single JSON object:
{
  "title": "Concise title",
  "problemStatement": "Detailed problem in Markdown",
  "examples": [{ "input": "...", "output": "...", "explanation": "..." }],
  "constraints": ["constraint strings"],
  "starterCode": "Java Solution class with a public method",
  "testCases": [{ "input": "stdin format", "expectedOutput": "exact stdout", "isSample": true }],
  "driverCode": "Java Main class: reads stdin, calls Solution, prints to stdout",
  "tags": ["topic tags"],
  "difficulty": "Easy|Medium|Hard",
  "hints": [
    "Hint 1 (Pattern Recognition): What pattern or category does this problem belong to? What similar problems exist?",
    "Hint 2 (Algorithm Choice): Which specific algorithm or data structure should you reach for? Why is it the right fit?",
    "Hint 3 (Implementation Trap): What tricky edge case, off-by-one error, or subtle constraint will trip you up if you're not careful?"
  ]
}

IMPORTANT RULES:
- starterCode must have a 'Solution' class with a public method
- driverCode must read from System.in and print to System.out
- testCases input must be machine-readable stdin (e.g. "3\\n1 2 3" for array [1,2,3])
- Provide at least 3 test cases including edge cases
- hints must teach reasoning: pattern recognition, algorithm choice, implementation traps
- Ensure driverCode correctly parses testCases input format`;

  // Strong model for generation
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("AI failed to generate a question.");
  }

  const questionData: Omit<Question, "id"> = JSON.parse(content);

  if (!questionData.hints || questionData.hints.length === 0) {
    questionData.hints = [
      "Think about what pattern or category this problem falls into.",
      "Consider which data structure gives you the best time-space tradeoff.",
      "Watch out for edge cases in the constraints — they often hide the real difficulty.",
    ];
  }

  const docRef = await adminDb.collection("questions").add({
    ...questionData,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id: docRef.id, ...questionData };
}

/**
 * Links a question to a project's subcollection.
 */
export async function linkQuestionToProject(
  projectId: string,
  question: Question,
  reason: RecommendationReason
): Promise<void> {
  if (!question.id) return;

  await adminDb
    .collection("projects")
    .doc(projectId)
    .collection("projectQuestions")
    .doc(question.id)
    .set({
      questionId: question.id,
      title: question.title,
      difficulty: question.difficulty,
      tags: question.tags,
      recommendationReason: reason.short,
      generatedAt: FieldValue.serverTimestamp(),
    });
}
