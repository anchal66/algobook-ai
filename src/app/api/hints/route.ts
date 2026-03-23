import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";
import { checkSubscription } from "@/lib/check-subscription";

// Cheap model for hints — no need for GPT-4o here
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const HINT_MODEL = "gpt-4o-mini";

const HINT_STRUCTURE = {
  1: {
    label: "Pattern Recognition",
    instruction:
      "Identify the PATTERN or CATEGORY this problem belongs to. Name similar classic problems. " +
      "Help the student recognize what type of problem this is so they can recall relevant techniques. " +
      "Do NOT mention a specific algorithm or data structure yet. Keep it to 2-3 sentences.",
  },
  2: {
    label: "Algorithm Choice",
    instruction:
      "Name the specific ALGORITHM or DATA STRUCTURE best suited for this problem and briefly explain WHY " +
      "it is the right choice (e.g., time complexity advantage, natural fit for the constraints). " +
      "Do NOT write any code or pseudocode. Keep it to 2-3 sentences.",
  },
  3: {
    label: "Implementation Trap",
    instruction:
      "Point out a specific EDGE CASE, OFF-BY-ONE error, or subtle CONSTRAINT that will trip the student up " +
      "during implementation. If the student provided code, identify the specific mistake or gap in their approach. " +
      "Do NOT give the full solution. Keep it to 2-3 sentences.",
  },
} as const;

export async function POST(request: Request) {
  try {
    const { questionId, hintLevel, userCode, userId } = await request.json();

    if (!questionId || !hintLevel || hintLevel < 1 || hintLevel > 3) {
      return NextResponse.json(
        { error: "questionId and hintLevel (1-3) are required" },
        { status: 400 }
      );
    }

    if (userId) {
      const sub = await checkSubscription(userId);
      if (!sub.active) {
        return NextResponse.json(
          { error: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" },
          { status: 403 }
        );
      }
    }

    const level = hintLevel as 1 | 2 | 3;
    const questionSnap = await adminDb.collection("questions").doc(questionId).get();
    if (!questionSnap.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const questionData = questionSnap.data()!;
    const storedHints: string[] = questionData.hints || [];

    // Return cached hint for levels 1-2 if available
    if (storedHints[level - 1] && level <= 2) {
      return NextResponse.json({
        hint: storedHints[level - 1],
        level,
        label: HINT_STRUCTURE[level].label,
        source: "stored",
      });
    }

    // Generate contextual hint using cheap model
    const hintSpec = HINT_STRUCTURE[level];

    const prompt = `You are a coding tutor helping a student who is stuck.

PROBLEM: ${questionData.title}
${questionData.problemStatement}

DIFFICULTY: ${questionData.difficulty}
TAGS: ${(questionData.tags || []).join(", ")}

${userCode ? `STUDENT'S CURRENT CODE:\n\`\`\`\n${userCode}\n\`\`\`\n` : ""}
YOUR TASK (${hintSpec.label}):
${hintSpec.instruction}

Respond with ONLY the hint text. No labels, prefixes, or markdown formatting.`;

    const completion = await openai.chat.completions.create({
      model: HINT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.7,
    });

    const hint =
      completion.choices[0].message.content?.trim() ||
      "Try breaking the problem into smaller subproblems and solving each one independently.";

    // Cache generated hint
    const updatedHints = [...storedHints];
    while (updatedHints.length < level) updatedHints.push("");
    updatedHints[level - 1] = hint;
    await adminDb.collection("questions").doc(questionId).update({ hints: updatedHints });

    return NextResponse.json({
      hint,
      level,
      label: hintSpec.label,
      source: "generated",
    });
  } catch (error) {
    console.error("Hints API error:", error);
    return NextResponse.json({ error: "Failed to generate hint" }, { status: 500 });
  }
}
