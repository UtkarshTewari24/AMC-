"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Flag } from "lucide-react";
import CoachPanel from "./CoachPanel";
import Latex from "./Latex";
import ProblemView, { Choices } from "./ProblemView";
import { Badge, Button, Card } from "./ui";
import {
  adaptiveDifficulty,
  attemptedProblemIds,
  newSessionId,
  recordAttempt,
  saveSession,
} from "@/lib/progress";
import { syncAttempt } from "@/lib/supabase/sync";
import type {
  AttemptRecord,
  Difficulty,
  Problem,
  SessionRecord,
  Topic,
} from "@/lib/types";

type DiffChoice = Difficulty | "all" | "adaptive";

export default function DrillSession({
  topic,
  difficulty,
  limit = 25,
  mode,
}: {
  topic: Topic | "All";
  difficulty: DiffChoice;
  limit?: number;
  mode: "drill" | "random";
}) {
  const [queue, setQueue] = useState<Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [autoFire, setAutoFire] = useState<"correct" | "wrong" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [solved, setSolved] = useState(0);
  const [correct, setCorrect] = useState(0);

  const sessionRef = useRef<SessionRecord | null>(null);
  const startedAt = useRef<number>(Date.now());

  const problem = queue[index] ?? null;

  const fetchBatch = useCallback(
    async (count: number, exclude: string[]) => {
      const diff =
        difficulty === "adaptive" ? adaptiveDifficulty(topic) : difficulty;
      const params = new URLSearchParams({
        topic,
        difficulty: diff,
        count: String(count),
      });
      if (exclude.length) params.set("exclude", exclude.slice(-300).join(","));
      const res = await fetch(`/api/problems?${params}`);
      if (!res.ok) throw new Error("failed to load problems");
      const data = (await res.json()) as { problems: Problem[] };
      return data.problems;
    },
    [topic, difficulty]
  );

  // initial load
  useEffect(() => {
    sessionRef.current = {
      id: newSessionId(),
      mode,
      label:
        mode === "random"
          ? "Random drill"
          : `${topic} · ${difficulty} drill`,
      startedAt: Date.now(),
      attempts: [],
    };
    setLoading(true);
    fetchBatch(Math.min(limit, 10), attemptedProblemIds())
      .then((problems) => {
        setQueue(problems);
        setError(problems.length ? null : "No problems match this filter yet.");
      })
      .catch(() => setError("Couldn't load problems — is the dataset present?"))
      .finally(() => setLoading(false));
    startedAt.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, difficulty, mode, limit]);

  const answer = (idx: number) => {
    if (!problem || answered) return;
    const isCorrect = idx === problem.answer;
    const attempt: AttemptRecord = {
      problemId: problem.id,
      sessionId: sessionRef.current!.id,
      chosen: idx,
      correct: isCorrect,
      timeSpent: Math.round((Date.now() - startedAt.current) / 1000),
      topic: problem.topic,
      difficulty: problem.difficulty,
      createdAt: Date.now(),
    };
    recordAttempt(attempt);
    void syncAttempt(attempt);
    sessionRef.current!.attempts.push(attempt);
    saveSession(sessionRef.current!);
    setChosen(idx);
    setAnswered(true);
    setAutoFire(isCorrect ? "correct" : "wrong");
    setSolved((s) => s + 1);
    if (isCorrect) setCorrect((c) => c + 1);
  };

  const next = async () => {
    setAutoFire(null);
    setChosen(null);
    setAnswered(false);
    startedAt.current = Date.now();
    if (solved >= limit) {
      setDone(true);
      return;
    }
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      return;
    }
    // fetch more, adapting difficulty as we go
    setLoading(true);
    try {
      const more = await fetchBatch(10, [
        ...attemptedProblemIds(),
        ...queue.map((p) => p.id),
      ]);
      if (!more.length) {
        setDone(true);
      } else {
        setQueue((q) => [...q, ...more]);
        setIndex(index + 1);
      }
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  // keyboard: Enter / N for next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (answered && (e.key === "Enter" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        void next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, index, queue.length, solved]);

  if (done || (error && !problem)) {
    const acc = solved ? Math.round((correct / solved) * 100) : 0;
    return (
      <div className="mx-auto max-w-xl py-16">
        <Card className="text-center">
          <Flag className="mx-auto h-8 w-8 text-accent-bright" />
          <h2 className="mt-3 text-xl font-bold">
            {error && !solved ? "Nothing to drill" : "Session complete"}
          </h2>
          {solved > 0 ? (
            <p className="mt-2 text-ink-dim">
              {correct}/{solved} correct ({acc}%)
            </p>
          ) : (
            <p className="mt-2 text-ink-dim">{error}</p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            {sessionRef.current && solved > 0 && (
              <Link href={`/results/${sessionRef.current.id}`}>
                <Button>See results</Button>
              </Link>
            )}
            <Link href="/">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-3 text-sm text-ink-dim">
          <Badge tone="accent">
            {mode === "random" ? "Random drill" : `${topic}`}
          </Badge>
          <span className="font-mono">
            {solved + (answered ? 0 : 1)}/{limit}
          </span>
          <span className="font-mono text-ink-faint">
            {correct} correct
          </span>
          {difficulty === "adaptive" && (
            <Badge tone="warn">adaptive</Badge>
          )}
        </div>

        {loading && !problem ? (
          <Card className="animate-pulse py-24 text-center text-ink-faint">
            Loading problems…
          </Card>
        ) : problem ? (
          <>
            <ProblemView problem={problem}>
              <Choices
                problem={problem}
                chosen={chosen}
                revealed={answered}
                onChoose={answer}
              />
            </ProblemView>

            {answered && (
              <Card className="mt-4">
                <div className="flex items-center justify-between">
                  <h3
                    className={
                      chosen === problem.answer
                        ? "font-semibold text-good"
                        : "font-semibold text-bad"
                    }
                  >
                    {chosen === problem.answer ? "Correct!" : "Not quite."}
                  </h3>
                  <div className="flex items-center gap-3">
                    <a
                      href={problem.aops_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-accent-bright"
                    >
                      AoPS <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button size="sm" onClick={() => void next()}>
                      Next <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {problem.solution && (
                  <details className="mt-3" open={chosen !== problem.answer}>
                    <summary className="cursor-pointer text-sm font-medium text-accent-bright">
                      Solution
                    </summary>
                    <div className="mt-2 text-sm leading-relaxed text-ink-dim">
                      <Latex text={problem.solution} />
                    </div>
                  </details>
                )}
              </Card>
            )}
          </>
        ) : null}
      </div>

      <div className="h-[calc(100vh-8rem)] lg:sticky lg:top-20">
        <CoachPanel
          problem={problem}
          userAnswer={chosen}
          answered={answered}
          autoFire={autoFire}
        />
      </div>
    </div>
  );
}
