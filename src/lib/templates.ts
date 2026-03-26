import fs from "fs";
import path from "path";
import type { TemplateInfo, TemplateQuestion } from "@/types";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

const TEMPLATE_META: Record<string, { company: string; title: string; description: string; purpose: string }> = {
  amazon: {
    company: "Amazon",
    title: "Amazon Interview Prep",
    description: "Curated problems frequently asked in Amazon technical interviews. Covers arrays, trees, dynamic programming, system design patterns, and more.",
    purpose: "Prepare for Amazon",
  },
  apple: {
    company: "Apple",
    title: "Apple Interview Prep",
    description: "Curated problems frequently asked in Apple technical interviews. Emphasizes clean code, recursion, string manipulation, and graph algorithms.",
    purpose: "Prepare for Apple",
  },
  google: {
    company: "Google",
    title: "Google Interview Prep",
    description: "Curated problems frequently asked in Google technical interviews. Heavy focus on dynamic programming, graphs, advanced data structures, and optimization.",
    purpose: "Prepare for Google",
  },
  meta: {
    company: "Meta",
    title: "Meta Interview Prep",
    description: "Curated problems frequently asked in Meta (Facebook) technical interviews. Focus on arrays, strings, trees, and graph traversal patterns.",
    purpose: "Prepare for Meta",
  },
  microsoft: {
    company: "Microsoft",
    title: "Microsoft Interview Prep",
    description: "Curated problems frequently asked in Microsoft technical interviews. Broad coverage of arrays, linked lists, trees, DP, and design patterns.",
    purpose: "Prepare for Microsoft",
  },
  uber: {
    company: "Uber",
    title: "Uber Interview Prep",
    description: "Curated problems frequently asked in Uber technical interviews. Focus on graphs, intervals, sliding window, and real-time system patterns.",
    purpose: "Prepare for Uber",
  },
};

function parseDifficulty(raw: string): "Easy" | "Medium" | "Hard" {
  const d = raw.trim().toLowerCase().replace(/\.$/, "");
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium"; // "med", "med.", "medium" all → Medium
}

function parseTemplateFile(filePath: string): TemplateQuestion[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const questions: TemplateQuestion[] = [];

  for (const line of lines) {
    // Format: "1. Two Sum - Easy" or "1922. Count Good Numbers - Med."
    const match = line.match(/^(\d+)\.\s+(.+?)\s+-\s+(.+)$/);
    if (!match) continue;
    questions.push({
      number: parseInt(match[1], 10),
      title: match[2].trim(),
      difficulty: parseDifficulty(match[3]),
    });
  }

  return questions;
}

// Cache parsed templates in-memory (server-side module, loaded once per cold start)
const cache = new Map<string, TemplateQuestion[]>();

/**
 * Returns list of available templates with metadata and question counts.
 */
export function getTemplateList(): TemplateInfo[] {
  const ids = Object.keys(TEMPLATE_META);
  return ids.map((id) => {
    const questions = getTemplateQuestions(id);
    const easy = questions.filter((q) => q.difficulty === "Easy").length;
    const medium = questions.filter((q) => q.difficulty === "Medium").length;
    const hard = questions.filter((q) => q.difficulty === "Hard").length;
    const meta = TEMPLATE_META[id];
    return {
      id,
      company: meta.company,
      title: meta.title,
      description: meta.description,
      purpose: meta.purpose,
      questionCount: questions.length,
      difficulties: { easy, medium, hard },
    };
  });
}

/**
 * Returns all questions for a given template.
 */
export function getTemplateQuestions(templateId: string): TemplateQuestion[] {
  if (cache.has(templateId)) return cache.get(templateId)!;

  const filePath = path.join(TEMPLATES_DIR, `${templateId}.md`);
  if (!fs.existsSync(filePath)) return [];

  const questions = parseTemplateFile(filePath);
  cache.set(templateId, questions);
  return questions;
}
