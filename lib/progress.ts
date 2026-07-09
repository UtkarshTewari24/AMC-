"use client";

import type {
  AttemptRecord,
  Difficulty,
  SessionRecord,
  Topic,
  TopicStats,
} from "./types";

/**
 * Guest-mode progress persistence (localStorage). When the user is signed
 * in via Supabase the same records are also mirrored to `user_attempts` /
 * `users.topic_stats` by lib/supabase/sync.ts — this module remains the
 * source of truth for the UI so the app works fully offline / signed out.
 */

const ATTEMPTS_KEY = "amc10.attempts.v1";
const SESSIONS_KEY = "amc10.sessions.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/blocked — practice continues without persistence
  }
}

export function getAttempts(): AttemptRecord[] {
  return read<AttemptRecord[]>(ATTEMPTS_KEY, []);
}

export function recordAttempt(attempt: AttemptRecord) {
  const attempts = getAttempts();
  attempts.push(attempt);
  write(ATTEMPTS_KEY, attempts);
}

export function getSessions(): SessionRecord[] {
  return read<SessionRecord[]>(SESSIONS_KEY, []);
}

export function getSession(id: string): SessionRecord | undefined {
  return getSessions().find((s) => s.id === id);
}

export function saveSession(session: SessionRecord) {
  const sessions = getSessions().filter((s) => s.id !== session.id);
  sessions.push(session);
  // keep the most recent 100 sessions
  write(SESSIONS_KEY, sessions.slice(-100));
}

export function attemptedProblemIds(): string[] {
  return [...new Set(getAttempts().map((a) => a.problemId))];
}

export function topicStats(): TopicStats {
  const stats: TopicStats = {};
  for (const a of getAttempts()) {
    const s = stats[a.topic] ?? { solved: 0, correct: 0 };
    s.solved += 1;
    if (a.correct) s.correct += 1;
    stats[a.topic] = s;
  }
  return stats;
}

export function overallStats() {
  const attempts = getAttempts();
  const correct = attempts.filter((a) => a.correct).length;
  const days = new Set(
    attempts.map((a) => new Date(a.createdAt).toDateString())
  );
  return {
    totalSolved: attempts.length,
    correct,
    accuracy: attempts.length ? correct / attempts.length : 0,
    streak: currentStreak(days),
    avgTime:
      attempts.length > 0
        ? attempts.reduce((t, a) => t + a.timeSpent, 0) / attempts.length
        : 0,
  };
}

function currentStreak(days: Set<string>): number {
  let streak = 0;
  const d = new Date();
  // today counts if practiced; otherwise streak starts from yesterday
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/**
 * Adaptive difficulty (PRD v1 rules): rolling accuracy over the last 10
 * attempts in a topic. >80% -> shift difficulty up, <50% -> shift down.
 */
export function adaptiveDifficulty(topic: Topic | "All"): Difficulty {
  const attempts = getAttempts().filter(
    (a) => topic === "All" || a.topic === topic
  );
  const recent = attempts.slice(-10);
  if (recent.length < 3) return "easy";
  const acc = recent.filter((a) => a.correct).length / recent.length;
  const current = recent[recent.length - 1].difficulty;
  const order: Difficulty[] = ["easy", "medium", "hard"];
  const idx = order.indexOf(current);
  if (acc > 0.8) return order[Math.min(idx + 1, 2)];
  if (acc < 0.5) return order[Math.max(idx - 1, 0)];
  return current;
}

/** Topics ranked weakest-first for adaptive topic weighting. */
export function weakestTopics(): Topic[] {
  const stats = topicStats();
  return (Object.keys(stats) as Topic[])
    .filter((t) => (stats[t]?.solved ?? 0) >= 3)
    .sort(
      (a, b) =>
        (stats[a]!.correct / stats[a]!.solved) -
        (stats[b]!.correct / stats[b]!.solved)
    );
}

export function newSessionId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
