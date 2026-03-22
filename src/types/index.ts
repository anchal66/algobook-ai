import { Timestamp } from "firebase/firestore";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type GoalType = "learn-basics" | "daily-practice" | "interview-prep" | "returning-after-break";

export interface TopicSkill {
  solved: number;
  failed: number;
  lastSeen: Timestamp;
}

export interface UserProfile {
  userId: string;
  experienceLevel: ExperienceLevel;
  goalType: GoalType;
  topicSkills: Record<string, TopicSkill>;
  totalSolved: number;
  totalFailed: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // ISO date string YYYY-MM-DD for easy comparison
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
  submittedAt: Timestamp;
}

export interface ProjectQuestion {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  generatedAt: Timestamp;
}
