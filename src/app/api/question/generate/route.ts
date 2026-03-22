import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  getOrCreateProfile,
  getWeakTopics,
  getRecommendedDifficulty,
  buildPerformanceSummary,
} from "@/lib/user-profile";
import { Question } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { prompt, projectId, userId } = await request.json();

    if (!prompt || !projectId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── 1. GATHER FULL CONTEXT ──

    const [projectSnap, projectQuestionsSnap, profile] = await Promise.all([
      adminDb.collection("projects").doc(projectId).get(),
      adminDb.collection("projects").doc(projectId).collection("projectQuestions").get(),
      getOrCreateProfile(userId),
    ]);

    const projectData = projectSnap.exists ? projectSnap.data()! : {};
    const projectDescription = projectData.description || "";
    const projectPurpose = projectData.purpose || "";
    const projectExperience = projectData.experienceLevel || profile.experienceLevel;
    const projectGoal = projectData.goalType || profile.goalType;

    const existingQuestions = projectQuestionsSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, title: data.title, tags: data.tags || [], difficulty: data.difficulty };
    });
    const existingIds = new Set(existingQuestions.map((q) => q.id));
    const existingTitles = existingQuestions.map(
      (q) => `${q.title} (${(q.tags || []).join(", ")}, ${q.difficulty})`
    );

    const weakTopics = getWeakTopics(profile);
    const recommendedDifficulty = getRecommendedDifficulty(profile);
    const performanceSummary = buildPerformanceSummary(profile);

    // ── 2. DETERMINE THE USER'S INTENT ──

    const isAutoNext = prompt === "__auto_next__";
    const userPrompt = isAutoNext
      ? buildAutoNextPrompt(weakTopics, recommendedDifficulty, existingQuestions)
      : prompt;

    // ── 3. TRY DATABASE FIRST (smarter lookup) ──

    let questionToReturn: Question | null = null;

    const promptKeywords = userPrompt
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2 && !STOP_WORDS.has(w));

    if (promptKeywords.length > 0) {
      const snapshot = await adminDb
        .collection("questions")
        .where("tags", "array-contains-any", promptKeywords.slice(0, 10))
        .limit(10)
        .get();

      const candidates = snapshot.docs.filter((d) => !existingIds.has(d.id));

      if (candidates.length > 0) {
        // Pick a random candidate, preferring matching difficulty
        const diffMatches = candidates.filter(
          (d) => d.data().difficulty === recommendedDifficulty
        );
        const pool = diffMatches.length > 0 ? diffMatches : candidates;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        questionToReturn = { id: pick.id, ...pick.data() } as Question;
        console.log("Found existing question (smart):", questionToReturn.title);
      }
    }

    // ── 4. AI GENERATION (context-aware) ──

    if (!questionToReturn) {
      console.log("Generating with AI (context-aware)...");

      const goalDescriptions: Record<string, string> = {
        "learn-basics": "learning programming fundamentals for the first time",
        "daily-practice": "daily coding practice to stay sharp",
        "interview-prep": "preparing for technical interviews at top companies",
        "returning-after-break": "returning to coding after a long break and needs to rebuild confidence with review questions before progressing",
      };

      const experienceGuidance: Record<string, string> = {
        beginner: "Use simple language, provide more detailed examples, and avoid advanced concepts. Focus on fundamental data structures and basic algorithms.",
        intermediate: "Assume familiarity with common data structures. Balance between standard patterns and slight variations.",
        advanced: "You may use advanced concepts, complex constraints, and multi-step solutions. Assume strong CS fundamentals.",
      };

      const systemPrompt = `You are an expert programming challenge creator for a personalized coding practice platform.

USER CONTEXT:
- Experience level: ${projectExperience}
- Goal: ${goalDescriptions[projectGoal] || projectGoal}
- Project: "${projectDescription}"${projectPurpose ? ` / Purpose: "${projectPurpose}"` : ""}

PERFORMANCE DATA:
${performanceSummary}

ALREADY SOLVED IN THIS PROJECT (do NOT repeat these or generate very similar problems):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "None yet (first question)"}

DIFFICULTY RECOMMENDATION: ${recommendedDifficulty}
${weakTopics.length > 0 ? `WEAK TOPICS TO CONSIDER: ${weakTopics.join(", ")}` : ""}

EXPERIENCE GUIDANCE: ${experienceGuidance[projectExperience] || experienceGuidance.intermediate}

The user's request is: "${userPrompt}"

Generate a UNIQUE coding challenge that hasn't been solved before in this project. You MUST respond with a single JSON object. The JSON must have this structure:
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
    "Hint 1: A high-level approach suggestion (what strategy to consider)",
    "Hint 2: The specific algorithm or data structure to use",
    "Hint 3: A key code insight or edge case to handle (without giving the full solution)"
  ]
}

IMPORTANT RULES:
- starterCode must have a 'Solution' class with a public method
- driverCode must read from System.in and print to System.out
- testCases input must be machine-readable stdin (e.g. "3\\n1 2 3" for array [1,2,3])
- Provide at least 3 test cases including edge cases
- hints must be 3 strings: progressively more specific but NEVER give the full answer
- Ensure driverCode correctly parses testCases input format`;

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

      const newQuestionData: Omit<Question, "id"> = JSON.parse(content);

      if (!newQuestionData.hints || newQuestionData.hints.length === 0) {
        newQuestionData.hints = [
          "Think about which data structure best fits this problem.",
          "Consider the time complexity of your approach.",
          "Look for edge cases in the constraints.",
        ];
      }

      const docRef = await adminDb.collection("questions").add({
        ...newQuestionData,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log("New context-aware question saved:", docRef.id);
      questionToReturn = { id: docRef.id, ...newQuestionData };
    }

    // ── 5. LINK TO PROJECT ──

    if (questionToReturn?.id) {
      await adminDb
        .collection("projects")
        .doc(projectId)
        .collection("projectQuestions")
        .doc(questionToReturn.id)
        .set({
          questionId: questionToReturn.id,
          title: questionToReturn.title,
          difficulty: questionToReturn.difficulty,
          tags: questionToReturn.tags,
          generatedAt: FieldValue.serverTimestamp(),
        });
    }

    return NextResponse.json({ question: questionToReturn });
  } catch (error) {
    console.error("Error in generate question API:", error);
    return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
  }
}

function buildAutoNextPrompt(
  weakTopics: string[],
  difficulty: string,
  existing: { title: string; tags: string[]; difficulty: string }[]
): string {
  if (existing.length === 0) {
    return "Give me a good starter question to warm up.";
  }

  if (weakTopics.length > 0) {
    const topic = weakTopics[Math.floor(Math.random() * Math.min(3, weakTopics.length))];
    return `Give me a ${difficulty.toLowerCase()} question on ${topic} to help me improve in that area.`;
  }

  const lastTags = existing[existing.length - 1]?.tags || [];
  if (lastTags.length > 0) {
    const randomTag = lastTags[Math.floor(Math.random() * lastTags.length)];
    return `Give me a ${difficulty.toLowerCase()} question. You can explore topics like ${randomTag} or introduce a new topic I haven't practiced.`;
  }

  return `Give me a ${difficulty.toLowerCase()} question on a topic I haven't explored yet.`;
}

const STOP_WORDS = new Set([
  "give", "me", "another", "question", "related", "with", "similar",
  "difficulty", "new", "easy", "medium", "hard", "the", "and", "for",
  "that", "this", "from", "have", "are", "was", "were", "been", "being",
  "some", "can", "could", "would", "should", "will", "just", "more",
  "about", "like", "want", "need", "please", "help", "practice",
]);
