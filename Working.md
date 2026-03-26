1. Mastery Scoring — 6-Factor Weighted Formula
Every topic skill gets a composite mastery score (0-100):

Factor	Weight	What it measures
Accuracy	30%	solved / (solved + failed)
Recency	15%	Decays to 0 over 30 days of inactivity
Difficulty Breadth	15%	Bonus for solving Easy + Medium + Hard
First-Try Rate	15%	Clean solves without retries
Time Efficiency	15%	Speed vs expected time per difficulty
Hint Independence	10%	Penalty for heavy hint usage
Topics with mastery < 50 are flagged as "weak" and prioritized in recommendations.

2. Spaced Repetition (SM-2 Algorithm)
Based on the proven SuperMemo SM-2 algorithm:

Review quality = 0 (fail), 1 (heavy help: ≥3 hints or slow), 2 (moderate help), 3 (clean first-try)
Quality < 2 → reset interval to 1 day, reduce ease factor
Quality ≥ 2 → interval grows exponentially (× ease factor), capped at 180 days
Urgency = 60% overdue factor + 40% mastery deficit — saturates at 14 days overdue
Topics due for review get 60% priority in mixed/revision practice.

3. Practice State Machine (6 States)
The engine tracks your progression through states:

State	Trigger	Strategy	Difficulty
Warm-up	New user or 14+ day absence	Familiar topics	Easy
Learning	< 10 problems solved	New topics	Adaptive
Strengthening	Weak topics exist or pass rate < 60%	Weak-first	Adaptive
Revision	≥ 3 due for review (or 1 due + 2 weak)	Spaced review	Easy
Interview-Prep	User chose this goal	Interview patterns	Medium
Maintenance	No weak topics, pass rate > 60%	Mixed variety	Adaptive
Returning users (14+ day gap) go through a 3-step calibration: Easy familiar → Medium familiar → Easy weakest.

4. Recommendation Engine — 5 Strategies
Based on your current state, one of 5 topic selection strategies fires:

weak-first — Topics with mastery < 50%, sorted ascending
new-topics — Unpracticed topics from 25 core topics
familiar — Topics you've solved before, prioritizing SM-2 due topics
interview-patterns — 15 key interview patterns, avoiding the last 3 practiced
mixed — 60% weighted to spaced-review due topics, 40% to weak topics, with randomization
Per-topic difficulty override: If your mastery on a specific topic differs from global difficulty, the system recalculates. Time efficiency < 0.5 triggers a downgrade penalty.

5. Prerequisite Graph (DAG)
A 16-node directed acyclic graph prevents skill gaps:

If a prerequisite has mastery < 50, it's flagged as a gap
Gap mastery < 45 → redirect to the prerequisite topic first
Gap mastery 45-49 → allow attempt (marginal gap)
AI prompt receives prerequisite context to bridge foundational concepts
6. Session Health / Fatigue Detection
Client-side health score starts at 100, with penalties:

Signal	Penalty	Threshold
Long session	-5 per 15 min	After 60 min
Pass rate declining	-15	≥ 20% drop (recent vs earlier)
Hint usage increasing	-10	Average up by > 0.5
Solve time increasing	-10	Average up by > 50%
3 consecutive failures	-15	—
Score < 30 → suggest 10-15 min break, difficulty drops by 1 level
Score < 60 → difficulty drops by 1 level
Score ≥ 90 + improving trend + ≥ 3 solved → difficulty increases by 1 level
7. Leaderboard Scoring
Consistency (streak) is weighted 2.5× more than volume — rewarding daily practice over grinding.

8. Question Sourcing — 3-Tier System
Tier 1: Curated Pool — Fast Firestore lookup matching topics + difficulty, excluding already-used questions
Tier 2: AI Generation (GPT-4o) — Rich context prompt with performance data, prerequisite gaps, time stats, calibration markers
Template Mode — "Inspired by" company questions (scored: +30 difficulty match, +25 weak topic, +20 due for review, -15 recent tag, +10 breadth)
The AI prompt dynamically adjusts for experience level (beginner/intermediate/advanced) and includes avoid-topics to prevent repetition.

9. Struggle-Adjusted Mastery
Post-submission, run count is compared to expected runs (Easy: 3, Medium: 5, Hard: 8):

Struggle index > 2.0 → mastery reduced by 15% (you struggled significantly)
Struggle index < 0.5 + first try → mastery boosted by 10% (clean solve)
This prevents gaming the system by brute-forcing solutions.