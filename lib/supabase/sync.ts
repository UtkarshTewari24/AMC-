"use client";

import { getSupabase } from "./client";
import { topicStats, overallStats } from "@/lib/progress";
import type { AttemptRecord } from "@/lib/types";

/**
 * Mirrors locally-recorded attempts to Supabase when the user is signed in.
 * All failures are silent — localStorage remains the UI's source of truth,
 * so a missing/unreachable Supabase never blocks practice.
 */
export async function syncAttempt(attempt: AttemptRecord): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_attempts").insert({
      user_id: user.id,
      problem_id: attempt.problemId,
      session_id: attempt.sessionId,
      chosen: attempt.chosen,
      correct: attempt.correct,
      time_spent: attempt.timeSpent,
    });

    const stats = overallStats();
    await supabase.from("users").upsert({
      id: user.id,
      streak: stats.streak,
      total_solved: stats.totalSolved,
      accuracy: stats.accuracy,
      topic_stats: topicStats(),
    });
  } catch {
    // offline / RLS / transient — ignore, local copy is authoritative
  }
}
