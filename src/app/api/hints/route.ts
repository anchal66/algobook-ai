import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { questionId, hintLevel, userCode } = await request.json();

    if (!questionId || !hintLevel || hintLevel < 1 || hintLevel > 3) {
      return NextResponse.json(
        { error: "questionId and hintLevel (1-3) are required" },
        { status: 400 }
      );
    }

    // Check stored hints first
    const questionSnap = await adminDb.collection("questions").doc(questionId).get();
    if (!questionSnap.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const questionData = questionSnap.data()!;
    const storedHints: string[] = questionData.hints || [];

    // Return stored hint if available (levels 1 and 2 are always from stored)
    if (storedHints[hintLevel - 1] && hintLevel <= 2) {
      return NextResponse.json({
        hint: storedHints[hintLevel - 1],
        level: hintLevel,
        source: "stored",
      });
    }

    // For level 3 or missing hints, generate contextually with AI
    const hintPrompts: Record<number, string> = {
      1: "Give a high-level approach hint. Suggest what general strategy or pattern to consider. Do NOT mention specific algorithms or data structures. Keep it to 1-2 sentences.",
      2: "Give a specific algorithm/data structure hint. Name the exact technique or structure that would work well here. Keep it to 1-2 sentences.",
      3: `Give a code-level hint. Point out a key insight, edge case, or implementation trick without writing the full solution. ${userCode ? "The user has written some code — guide them based on what they have so far." : ""}Keep it to 2-3 sentences.`,
    };

    const systemPrompt = `You are a helpful coding tutor. The student is stuck on this problem and needs a hint. 
    
Problem: ${questionData.title}
${questionData.problemStatement}

${userCode ? `Student's current code:\n\`\`\`\n${userCode}\n\`\`\`` : ""}

${hintPrompts[hintLevel]}

Respond with ONLY the hint text, no labels or prefixes.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: systemPrompt }],
      max_tokens: 200,
    });

    const hint = completion.choices[0].message.content?.trim() || "Try breaking the problem into smaller parts.";

    // Cache the generated hint on the question document
    if (storedHints.length < hintLevel) {
      while (storedHints.length < hintLevel - 1) {
        storedHints.push("");
      }
      storedHints[hintLevel - 1] = hint;
      await adminDb.collection("questions").doc(questionId).update({ hints: storedHints });
    }

    return NextResponse.json({
      hint,
      level: hintLevel,
      source: "generated",
    });
  } catch (error) {
    console.error("Hints API error:", error);
    return NextResponse.json({ error: "Failed to generate hint" }, { status: 500 });
  }
}
