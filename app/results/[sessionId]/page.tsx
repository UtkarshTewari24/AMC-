"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { getSession } from "@/lib/progress";
import type { Problem, SessionRecord, Topic } from "@/lib/types";

/** AMC scoring: +6 per correct, 0 otherwise (post-2012 rules, no penalty). */
function amcScore(correct: number): number {
  return correct * 6;
}

export default function ResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionRecord | null | undefined>(
    undefined
  );
  const [problems, setProblems] = useState<Record<string, Problem>>({});

  useEffect(() => {
    const s = getSession(params.sessionId) ?? null;
    setSession(s);
    if (s) {
      Promise.all(
        s.attempts.map((a) =>
          fetch(`/api/problems/${a.problemId}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      ).then((results) => {
        const map: Record<string, Problem> = {};
        for (const r of results) {
          if (r?.problem) map[r.problem.id] = r.problem;
        }
        setProblems(map);
      });
    }
  }, [params.sessionId]);

  if (session === undefined) {
    return <div className="py-24 text-center text-ink-faint">Loading…</div>;
  }
  if (session === null) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <p className="text-ink-dim">
          Session not found on this device — results are stored locally.
        </p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const attempts = session.attempts;
  const correct = attempts.filter((a) => a.correct).length;
  const skipped = attempts.filter((a) => a.chosen === null).length;
  const totalTime = attempts.reduce((t, a) => t + a.timeSpent, 0);
  const isTest = session.mode === "test";

  const byTopic = new Map<Topic, { solved: number; correct: number }>();
  for (const a of attempts) {
    const s = byTopic.get(a.topic) ?? { solved: 0, correct: 0 };
    s.solved++;
    if (a.correct) s.correct++;
    byTopic.set(a.topic, s);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">{session.label}</h1>
      <p className="text-sm text-ink-faint">
        {new Date(session.startedAt).toLocaleString()}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {isTest && (
          <Card className="text-center">
            <div className="font-mono text-3xl font-bold text-accent-bright">
              {amcScore(correct)}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
              AMC score / 150
            </div>
          </Card>
        )}
        <Card className="text-center">
          <div className="font-mono text-3xl font-bold">
            {correct}/{attempts.length}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
            correct{skipped ? ` · ${skipped} skipped` : ""}
          </div>
        </Card>
        <Card className="text-center">
          <div className="font-mono text-3xl font-bold">
            {attempts.length
              ? Math.round((correct / attempts.length) * 100)
              : 0}
            %
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
            accuracy
          </div>
        </Card>
        <Card className="text-center">
          <div className="font-mono text-3xl font-bold">
            {attempts.length
              ? Math.round(totalTime / attempts.length)
              : 0}
            s
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-ink-faint">
            avg / problem
          </div>
        </Card>
      </div>

      {/* topic breakdown bars */}
      <Card className="mt-6">
        <h2 className="font-semibold">Topic breakdown</h2>
        <div className="mt-4 space-y-3">
          {[...byTopic.entries()].map(([topic, s]) => (
            <div key={topic}>
              <div className="flex justify-between text-sm">
                <span>{topic}</span>
                <span className="font-mono text-xs text-ink-faint">
                  {s.correct}/{s.solved}
                </span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-navy-800">
                <div
                  className="h-full bg-good"
                  style={{ width: `${(s.correct / s.solved) * 100}%` }}
                />
                <div
                  className="h-full bg-bad/70"
                  style={{
                    width: `${((s.solved - s.correct) / s.solved) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* review list */}
      <Card className="mt-6">
        <h2 className="font-semibold">Review</h2>
        <div className="mt-3 divide-y divide-navy-800">
          {attempts.map((a, i) => {
            const p = problems[a.problemId];
            return (
              <Link
                key={i}
                href={`/problem/${a.problemId}`}
                className="flex items-center gap-3 py-2.5 text-sm hover:bg-navy-800/50"
              >
                <span
                  className={
                    a.correct
                      ? "h-2.5 w-2.5 shrink-0 rounded-full bg-good"
                      : a.chosen === null
                        ? "h-2.5 w-2.5 shrink-0 rounded-full bg-navy-600"
                        : "h-2.5 w-2.5 shrink-0 rounded-full bg-bad"
                  }
                />
                <span className="text-ink-dim">
                  {p
                    ? `${p.year} ${p.contest} #${p.number} · ${p.topic}`
                    : a.problemId.slice(0, 8)}
                </span>
                <span className="ml-auto font-mono text-xs text-ink-faint">
                  {a.timeSpent}s
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="mt-6 flex gap-3">
        <Link href="/drill">
          <Button>Drill again</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
