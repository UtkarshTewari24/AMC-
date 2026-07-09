import "server-only";
import fs from "fs";
import path from "path";
import type { Difficulty, Problem, Topic } from "./types";

/**
 * Problem bank access. Reads the scraped dataset committed at
 * data/problems.json. When Supabase is configured the seed script mirrors
 * this file into the `problems` table for auth'd persistence, but the app
 * always serves problems from the bundled JSON — no external dependency in
 * the hot path.
 */

let cache: Problem[] | null = null;

export function allProblems(): Problem[] {
  if (cache) return cache;
  const candidates = [
    path.join(process.cwd(), "data", "problems.json"),
    path.join(process.cwd(), "data", "problems.sample.json"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Problem[];
      // only serve problems that are fully usable in the UI
      cache = raw.filter(
        (p) =>
          p.question &&
          p.choices?.length === 5 &&
          p.answer !== null &&
          p.answer !== undefined
      );
      return cache;
    }
  }
  cache = [];
  return cache;
}

export function getProblem(id: string): Problem | undefined {
  return allProblems().find((p) => p.id === id);
}

export interface ProblemFilter {
  topic?: Topic | "All";
  difficulty?: Difficulty | "all";
  contest?: string;
  year?: number;
  excludeIds?: string[];
}

export function filterProblems(f: ProblemFilter): Problem[] {
  const exclude = new Set(f.excludeIds ?? []);
  return allProblems().filter((p) => {
    if (f.topic && f.topic !== "All" && p.topic !== f.topic) return false;
    if (f.difficulty && f.difficulty !== "all" && p.difficulty !== f.difficulty)
      return false;
    if (f.contest && p.contest !== f.contest) return false;
    if (f.year && p.year !== f.year) return false;
    if (exclude.has(p.id)) return false;
    return true;
  });
}

export function sampleProblems(f: ProblemFilter, count: number): Problem[] {
  const pool = filterProblems(f);
  // Fisher-Yates on a copy, take the first `count`
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

export function bankStats() {
  const problems = allProblems();
  const byTopic: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const contests = new Set<string>();
  for (const p of problems) {
    byTopic[p.topic] = (byTopic[p.topic] ?? 0) + 1;
    byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] ?? 0) + 1;
    contests.add(`${p.year} ${p.contest}`);
  }
  return {
    total: problems.length,
    contests: contests.size,
    byTopic,
    byDifficulty,
  };
}

export function listContests(): { year: number; contest: string }[] {
  const seen = new Map<string, { year: number; contest: string }>();
  for (const p of allProblems()) {
    seen.set(`${p.year} ${p.contest}`, { year: p.year, contest: p.contest });
  }
  return [...seen.values()].sort(
    (a, b) => b.year - a.year || a.contest.localeCompare(b.contest)
  );
}
