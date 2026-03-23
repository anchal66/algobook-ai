import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/check-subscription";

const JUDGE0_API_URL = `https://${process.env.NEXT_PUBLIC_RAPIDAPI_HOST}/submissions?base64_encoded=false&wait=true`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userCode, driverCode, stdin, userId } = body;

    if (!userCode || !driverCode) {
      return NextResponse.json({ error: "Missing user code or driver code" }, { status: 400 });
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

    // --- FIX START: This is the only line that needs to change ---
    
    // Regex to find all import statements, including wildcards (like .*)
    // The key change is adding '\*' to the character class [\w\.\*]+
    const importRegex = /import\s+[\w\.\*]+;?/g;

    // --- FIX END ---

    // 1. Extract imports from both code blocks
    const userImports = userCode.match(importRegex) || [];
    const driverImports = driverCode.match(importRegex) || [];

    // 2. Remove imports from the code blocks
    let userCodeWithoutImports = userCode.replace(importRegex, '').trim();
    const driverCodeWithoutImports = driverCode.replace(importRegex, '').trim();

    // Judge0 compiles into Main.java — only one public class allowed per file.
    // Strip "public" from any non-Main class (e.g. "public class Solution" → "class Solution")
    userCodeWithoutImports = userCodeWithoutImports.replace(
      /public\s+(class\s+(?!Main\b)\w+)/g,
      '$1'
    );

    // 3. Combine and de-duplicate all imports
    const allImports = [...new Set([...userImports, ...driverImports])];
    const combinedImports = allImports.join('\n');

    // 4. Create the final, valid Java file
    const fullSourceCode = `
${combinedImports}

// User's Solution Code
${userCodeWithoutImports}

// Driver Code
${driverCodeWithoutImports}
    `;

    // DEBUG: Log the final code to check it
    // console.log("--- FULL SOURCE CODE ---");
    // console.log(fullSourceCode);
    // console.log("------------------------");

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST!,
      },
      body: JSON.stringify({
        source_code: fullSourceCode, // Send the new combined code
        language_id: 62, // Java
        stdin: stdin || "",
      }),
    };

    const response = await fetch(JUDGE0_API_URL, options);
    const result = await response.json();
    
    if (!response.ok) {
        console.error("Judge0 API Error:", result);
        throw new Error(result.error || "Failed to execute code");
    }

    return NextResponse.json(result);

  } catch (error: any) { 
    console.error("Error in run code API:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}