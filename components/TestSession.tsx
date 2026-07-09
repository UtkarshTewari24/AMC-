"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProblemView, { Choices } from "./ProblemView";
import { Button, Card, cn } from "./ui";
import { newSessionId, recordAttempt, saveSession } from "@/lib/progress";
import { syncAttempt } from "@/lib/supabase/sync";
import type { AttemptRecord, Problem, SessionRecord } from "@/lib/types";

const TEST_SECONDS = 75 * 60;

export default function TestSession({
  year,
  contest,
}: {
  year: number;
  contest: string;
}) {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const enteredAt = useRef<number>(Date.now());
  const timeSpent = useRef<number[]>([]);

  useEffect(() => {
    fetch(`/api/problems?year=${year}&contest=${encodeURIComponent(contest)}`)
      .then((r) => r.json())
      .then((d) => {
        setProblems(d.problems ?? []);
        setAnswers(new Array(d.problems?.length ?? 0).fill(null));
        timeSpent.current = new Array(d.problems?.length ?? 0).fill(0);
      })
      .finally(() => setLoading(false));
  }, [year, contest]);

  // countdown
  useEffect(() => {
    if (submitted || loading) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, loading]);

  const trackTime = () => {
    timeSpent.current[current] += Math.round(
      (Date.now() - enteredAt.current) / 1000
    );
    enteredAt.current = Date.now();
  };

  const goto = (i: number) => {
    trackTime();
    setCurrent(Math.max(0, Math.min(problems.length - 1, i)));
  };

  const choose = (idx: number) => {
    setAnswers((a) => {
      const next = [...a];
      // clicking the selected choice again clears it
      next[current] = next[current] === idx ? null : idx;
      return next;
    });
  };

  const submit = () => {
    if (submitted) return;
    trackTime();
    setSubmitted(true);
    const sessionId = newSessionId();
    const session: SessionRecord = {
      id: sessionId,
      mode: "test",
      label: `${year} ${contest} practice test`,
      startedAt: Date.now() - (TEST_SECONDS - secondsLeft) * 1000,
      attempts: [],
    };
    problems.forEach((p, i) => {
      const chosen = answers[i];
      const attempt: AttemptRecord = {
        problemId: p.id,
        sessionId,
        chosen,
        correct: chosen !== null && chosen === p.answer,
        timeSpent: timeSpent.current[i] ?? 0,
        topic: p.topic,
        difficulty: p.difficulty,
        createdAt: Date.now(),
      };
      session.attempts.push(attempt);
      recordAttempt(attempt);
      void syncAttempt(attempt);
    });
    saveSession(session);
    router.push(`/results/${sessionId}`);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-ink-faint">Loading test…</div>
    );
  }
  if (!problems.length) {
    return (
      <div className="py-24 text-center text-ink-dim">
        Couldn&apos;t load {year} {contest}.
      </div>
    );
  }

  const problem = problems[current];
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const answeredCount = answers.filter((a) => a !== null).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* header: timer + nav grid */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-navy-700 bg-navy-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "font-mono text-xl font-bold tabular-nums",
              secondsLeft < 300 ? "text-bad" : "text-accent-bright"
            )}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <span className="text-sm text-ink-faint">
            {year} {contest} · {answeredCount}/{problems.length} answered
          </span>
          <Button size="sm" className="ml-auto" onClick={submit}>
            Submit test
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {problems.map((_, i) => (
            <button
              key={i}
              onClick={() => goto(i)}
              className={cn(
                "h-7 w-7 rounded font-mono text-xs transition-colors",
                i === current
                  ? "bg-accent text-white"
                  : answers[i] !== null
                    ? "bg-accent/25 text-accent-bright"
                    : "bg-navy-800 text-ink-faint hover:bg-navy-700"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <ProblemView problem={problem}>
          <Choices
            problem={problem}
            chosen={answers[current]}
            revealed={false}
            onChoose={choose}
          />
        </ProblemView>

        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={current === 0}
            onClick={() => goto(current - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="font-mono text-sm text-ink-faint">
            {current + 1} / {problems.length}
          </span>
          <Button
            variant="outline"
            disabled={current === problems.length - 1}
            onClick={() => goto(current + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Card className="mt-6 text-sm text-ink-faint">
          No feedback until you submit — just like the real thing. Selecting a
          choice again clears it (skips score 0, wrong answers score 0, correct
          answers score 6).
        </Card>
      </div>
    </div>
  );
}
