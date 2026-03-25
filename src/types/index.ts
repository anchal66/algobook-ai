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
  // Spaced repetition (SM-2 inspired)
  nextReviewDate: string;   // ISO YYYY-MM-DD — when this topic should be revisited
  interval: number;         // days until next review (starts at 1)
  easeFactor: number;       // SM-2 ease factor (starts at 2.5, min 1.3)
  // Performance depth
  timeEfficiency: number;   // rolling avg of expectedTime/actualTime, 1.0 = on-pace
  totalHintsUsed: number;   // cumulative hints across all attempts on this topic
  totalRunCount: number;    // cumulative Run-before-Submit clicks (struggle signal)
}

export interface UserProfile {
  userId: string;
  username: string;
  usernameChangesLeft: number;
  displayName: string;
  email: string;
  photoURL: string;
  bio: string;
  company: string;
  address: string;
  college: string;
  githubUrl: string;
  linkedinUrl: string;
  skills: string[];
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
  runCount: number;       // how many Run clicks before this Submit (struggle signal)
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

// ── SOLUTION EXPLANATION (post-solve AI analysis) ──

export interface SolutionExplanation {
  analysis: string;          // What the user's code does
  timeComplexity: string;    // Big-O time
  spaceComplexity: string;   // Big-O space
  optimalApproach: string;   // Description of optimal algorithm
  improvements: string[];    // Specific improvements to user's code
  alternativeApproaches: string[]; // Other valid strategies
}

// ── LEADERBOARD ──

export interface LeaderboardEntry {
  userId: string;
  username: string;
  photoURL: string;
  displayName: string;
  score: number;
  totalSolved: number;
  currentStreak: number;
  avgMastery: number;
  rank: number;
}

// ── SESSION HEALTH (client-side fatigue detection) ──

export interface SessionAttempt {
  passed: boolean;
  hintsUsed: number;
  solveTimeSeconds: number;
  timestamp: number; // Date.now()
}

export interface SessionHealth {
  score: number;             // 0-100
  problemsAttempted: number;
  problemsSolved: number;
  sessionMinutes: number;
  trend: "improving" | "stable" | "declining";
  suggestion: string | null;
}

// ── PREREQUISITE GRAPH ──

export interface PrerequisiteGap {
  topic: string;              // The prerequisite topic
  requiredMastery: number;    // Minimum mastery needed (50)
  currentMastery: number;     // User's current mastery
  prerequisiteOf: string;     // The topic this is a prerequisite for
}
