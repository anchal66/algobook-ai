/**
 * Zod schemas for every structured model output (Module 02 §3.2).
 * Strict-mode rules for OpenAI structured outputs: every field required (use `.nullable()`
 * instead of `.optional()`), no `.default()`, no string length constraints (enforced post-parse).
 */
import { z } from "zod";
import { CheckerTypeSchema, DifficultySchema, ReviewSchema } from "@/lib/data/schema";

export const TYPE_SPECS = ["int", "long", "double", "bool", "string", "char", "int[]", "long[]", "double[]", "string[]", "char[]", "int[][]", "string[][]", "ListNode", "TreeNode"] as const;
export const ParamTypeSpecSchema = z.enum(TYPE_SPECS);
export const ReturnTypeSpecSchema = z.enum([...TYPE_SPECS, "void"]);
export type TypeSpec = z.infer<typeof ReturnTypeSpecSchema>;

export const TestSchema = z.object({ input: z.string(), expectedOutput: z.string() });
export const HintSchema = z.object({ label: z.string(), text: z.string() });
export const ExampleSpecSchema = z.object({ input: z.string(), output: z.string(), explanation: z.string().nullable() });

export const ProblemSpecSchema = z.object({
  title: z.string(),
  slug: z.string(),
  difficulty: DifficultySchema,
  tags: z.array(z.string()).min(1).max(5),
  statementMd: z.string(),
  functionName: z.string(),
  returnType: ReturnTypeSpecSchema,
  params: z.array(z.object({ name: z.string(), type: ParamTypeSpecSchema })).min(1).max(5),
  examples: z.array(ExampleSpecSchema).min(2).max(3),
  constraints: z.array(z.string()).min(2).max(8),
  followUp: z.string().nullable(),
  checker: z.object({ type: CheckerTypeSchema, eps: z.number().nullable() }),
  sampleTests: z.array(TestSchema).min(2).max(3),
  hiddenTests: z.array(TestSchema).min(8).max(14),
  starter: z.object({ java: z.string() }),
  driver: z.object({ java: z.string() }),
  reference: z.object({ java: z.string() }),
  hints: z.array(HintSchema).min(3).max(3),
  timeLimitSec: z.number().min(1).max(5),
});
export type ProblemSpec = z.infer<typeof ProblemSpecSchema>;

export const DriverBundleSchema = z.object({ starter: z.string(), driver: z.string(), reference: z.string() });
export type DriverBundle = z.infer<typeof DriverBundleSchema>;

export const EditorialSchema = z.object({
  overview: z.string(),
  approaches: z.array(z.object({
    title: z.string(),
    intuition: z.string(),
    algorithm: z.string(),
    code: z.object({ java: z.string(), python: z.string().nullable() }),
    time: z.string(),
    space: z.string(),
  })).min(1).max(4),
  pitfalls: z.array(z.string()).max(5),
});
export type Editorial = z.infer<typeof EditorialSchema>;

export { ReviewSchema };
export type Review = z.infer<typeof ReviewSchema>;

export const InsightsSchema = z.object({
  totalRecommended: z.number().int(),
  easyCount: z.number().int(),
  mediumCount: z.number().int(),
  hardCount: z.number().int(),
  estimatedHoursPerWeek: z.number(),
  keyTopics: z.array(z.string()).max(8),
  milestones: z.array(z.object({ label: z.string(), questionsTarget: z.number().int(), description: z.string() })).min(3).max(3),
  tip: z.string(),
  weeklyPlan: z.array(z.object({ week: z.number().int(), focus: z.array(z.string()).max(4), target: z.number().int() })).min(1).max(12),
});
export type Insights = z.infer<typeof InsightsSchema>;

/** Wire shape of a tutor-chat turn (client → server). */
export const ChatTurnSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) });
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
