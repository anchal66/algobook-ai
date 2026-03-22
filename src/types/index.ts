import { Timestamp } from "firebase/firestore";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type GoalType = "learn-basics" | "daily-practice" | "interview-prep" | "returning-after-break";

export type PracticeState =
  | "warm-up"
  | "learning"
  | "strengthening"
  | "revision"
  | "interview-prep"
  | "maintenance";

export interface TopicSkill {
  solved: number;
  failed: number;
  lastSeen: Timestamp;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  totalAttempts: number;
  firstTrySuccesses: number;
  avgTimeSeconds: number;
  masteryScore: number; // 0-100 composite score
}

export interface UserProfile {
  userId: string;
  experienceLevel: ExperienceLevel;
  goalType: GoalType;
  practiceState: PracticeState;
  topicSkills: Record<string, TopicSkill>;
  totalSolved: number;
  totalFailed: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // ISO YYYY-MM-DD
  calibrationComplete: boolean; // whether returning user finished warm-up sequence
  calibrationStep: number; // 0=easy warm-up, 1=medium familiar, 2=weak recap, 3=done
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isSample?: boolean;
}

export interface Question {
  id?: string;
  title: string;
  problemStatement: string;
  examples: Example[];
  constraints: string[];
  starterCode: string;
  testCases: TestCase[];
  driverCode: string;
  tags: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  hints?: string[];
  createdAt?: Timestamp;
}

export interface Submission {
  id?: string;
  userId: string;
  projectId: string;
  questionId: string;
  code: string;
  status: "success" | "fail" | "pending";
  attemptNumber: number;
  hintsUsed: number;
  timeSpentSeconds: number;
  isFirstTry: boolean;
  submittedAt: Timestamp;
}

export interface ProjectQuestion {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  generatedAt: Timestamp;
}

export interface RecommendationReason {
  short: string;   // e.g. "Weak topic: graphs"
  detail: string;  // e.g. "Picked because you solved only 1/4 graph problems"
}

export interface QuestionWithReason {
  question: Question;
  reason: RecommendationReason;
  source: "curated" | "generated";
}
