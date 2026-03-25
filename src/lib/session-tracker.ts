import type { SessionAttempt, SessionHealth } from "@/types";

/**
 * Client-side session health tracker.
 *
 * Tracks fatigue signals during a coding session (no Firestore writes):
 *   - Declining pass rate
 *   - Increasing hint usage
 *   - Increasing solve time
 *   - Session duration
 *
 * Health score starts at 100 and decays as fatigue signals accumulate.
 * Used to adjust recommendation difficulty and suggest breaks.
 */

export interface SessionState {
  startTime: number;     // Date.now() when session started
  attempts: SessionAttempt[];
}

export function createSession(): SessionState {
  return {
    startTime: Date.now(),
    attempts: [],
  };
}

export function recordAttempt(
  session: SessionState,
  passed: boolean,
  hintsUsed: number,
  solveTimeSeconds: number,
): SessionState {
  return {
    ...session,
    attempts: [
      ...session.attempts,
      {
        passed,
        hintsUsed,
        solveTimeSeconds,
        timestamp: Date.now(),
      },
    ],
  };
}

export function computeSessionHealth(session: SessionState): SessionHealth {
  const { attempts, startTime } = session;
  const sessionMinutes = Math.round((Date.now() - startTime) / 60000);
  const problemsAttempted = attempts.length;
  const problemsSolved = attempts.filter((a) => a.passed).length;

  if (problemsAttempted === 0) {
    return {
      score: 100,
      problemsAttempted: 0,
      problemsSolved: 0,
      sessionMinutes,
      trend: "stable",
      suggestion: null,
    };
  }

  let score = 100;

  // ── DURATION PENALTY ──
  // After 60 minutes, lose 5 points per 15-minute block
  if (sessionMinutes > 60) {
    const extraBlocks = Math.floor((sessionMinutes - 60) / 15);
    score -= extraBlocks * 5;
  }

  // ── PASS RATE DECLINE ──
  // Compare recent 3 vs earlier attempts
  if (problemsAttempted >= 4) {
    const recentCount = Math.min(3, problemsAttempted);
    const recent = attempts.slice(-recentCount);
    const earlier = attempts.slice(0, -recentCount);

    if (earlier.length > 0) {
      const recentPassRate = recent.filter((a) => a.passed).length / recent.length;
      const earlierPassRate = earlier.filter((a) => a.passed).length / earlier.length;

      // If recent pass rate dropped 20%+ below earlier
      if (earlierPassRate - recentPassRate >= 0.2) {
        score -= 15;
      }
    }
  }

  // ── HINT USAGE INCREASE ──
  if (problemsAttempted >= 4) {
    const mid = Math.floor(problemsAttempted / 2);
    const firstHalf = attempts.slice(0, mid);
    const secondHalf = attempts.slice(mid);

    const firstAvgHints = firstHalf.reduce((s, a) => s + a.hintsUsed, 0) / firstHalf.length;
    const secondAvgHints = secondHalf.reduce((s, a) => s + a.hintsUsed, 0) / secondHalf.length;

    if (secondAvgHints > firstAvgHints + 0.5) {
      score -= 10;
    }
  }

  // ── SOLVE TIME INCREASE ──
  if (problemsAttempted >= 4) {
    const mid = Math.floor(problemsAttempted / 2);
    const firstHalf = attempts.slice(0, mid);
    const secondHalf = attempts.slice(mid);

    const firstAvgTime = firstHalf.reduce((s, a) => s + a.solveTimeSeconds, 0) / firstHalf.length;
    const secondAvgTime = secondHalf.reduce((s, a) => s + a.solveTimeSeconds, 0) / secondHalf.length;

    // If recent avg time increased 50%+ over earlier
    if (firstAvgTime > 0 && secondAvgTime > firstAvgTime * 1.5) {
      score -= 10;
    }
  }

  // ── CONSECUTIVE FAILURES ──
  // 3+ failures in a row is a strong fatigue signal
  if (problemsAttempted >= 3) {
    const last3 = attempts.slice(-3);
    if (last3.every((a) => !a.passed)) {
      score -= 15;
    }
  }

  score = Math.max(0, Math.min(100, score));

  // ── TREND DETECTION ──
  let trend: SessionHealth["trend"] = "stable";
  if (problemsAttempted >= 3) {
    const recentPassed = attempts.slice(-3).filter((a) => a.passed).length;
    const earlierGroup = attempts.slice(0, Math.max(1, problemsAttempted - 3));
    const earlierPassRate = earlierGroup.filter((a) => a.passed).length / earlierGroup.length;
    const recentPassRate = recentPassed / 3;

    if (recentPassRate > earlierPassRate + 0.15) trend = "improving";
    else if (recentPassRate < earlierPassRate - 0.15) trend = "declining";
  }

  // ── SUGGESTION ──
  let suggestion: string | null = null;
  if (score < 30) {
    suggestion = "Your performance is declining significantly. Research shows that taking a 10-15 minute break improves problem-solving by 20%. Consider stepping away.";
  } else if (score < 60) {
    suggestion = "You've been coding for a while and your efficiency is dropping. A 5-minute break can help restore focus.";
  }

  return {
    score,
    problemsAttempted,
    problemsSolved,
    sessionMinutes,
    trend,
    suggestion,
  };
}
