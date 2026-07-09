"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Sparkles, Wand2 } from "lucide-react";
import Latex from "@/components/Latex";
import ProblemView, { Choices } from "@/components/ProblemView";
import { Badge, Button, Card, cn } from "@/components/ui";
import { recordAttempt, newSessionId } from "@/lib/progress";
import { aiHeaders, hasApiKey } from "@/lib/settings";
import { TOPICS, type Difficulty, type Problem, type Topic } from "@/lib/types";

const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

export default function GeneratePage() {
  const [topic, setTopic] = useState<Topic | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(3);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setProblems([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({ topic, difficulty, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
      } else {
        setProblems(data.problems);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Wand2 className="h-6 w-6 text-accent-bright" /> Generate problems
      </h1>
      <p className="mt-1 text-ink-dim">
        Create fresh AMC 10-style problems with answers and solutions, then
        solve them right here.
      </p>

      {!hasApiKey() && (
        <Card className="mt-4 border-warn/40 bg-warn/5">
          <p className="text-sm text-ink-dim">
            This needs your Anthropic API key.{" "}
            <Link href="/settings" className="text-accent-bright hover:underline">
              Add it in Settings →
            </Link>
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Topic
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["All", ...TOPICS] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                topic === t
                  ? "border-accent bg-accent/15 text-accent-bright"
                  : "border-navy-600 text-ink-dim hover:border-accent-bright"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
              Difficulty
            </div>
            <div className="mt-2 flex gap-2">
              {DIFFS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm capitalize transition-colors",
                    difficulty === d
                      ? "border-accent bg-accent/15 text-accent-bright"
                      : "border-navy-600 text-ink-dim hover:border-accent-bright"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
              How many
            </div>
            <div className="mt-2 flex gap-2">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={cn(
                    "h-8 w-8 rounded-full border text-sm transition-colors",
                    count === n
                      ? "border-accent bg-accent/15 text-accent-bright"
                      : "border-navy-600 text-ink-dim hover:border-accent-bright"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Button size="lg" onClick={generate} disabled={loading || !hasApiKey()}>
            {loading ? (
              "Generating…"
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate {count} problem
                {count > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </Card>

      {loading && (
        <Card className="mt-4 animate-pulse py-16 text-center text-ink-faint">
          Writing original problems…
        </Card>
      )}

      <div className="mt-6 space-y-6">
        {problems.map((p) => (
          <GeneratedProblemCard key={p.id} problem={p} />
        ))}
      </div>
    </div>
  );
}

function GeneratedProblemCard({ problem }: { problem: Problem }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const answer = (idx: number) => {
    if (answered) return;
    setChosen(idx);
    setAnswered(true);
    // count generated attempts toward local stats too
    recordAttempt({
      problemId: problem.id,
      sessionId: newSessionId(),
      chosen: idx,
      correct: idx === problem.answer,
      timeSpent: 0,
      topic: problem.topic,
      difficulty: problem.difficulty,
      createdAt: Date.now(),
    });
  };

  return (
    <ProblemView problem={problem}>
      <Choices
        problem={problem}
        chosen={chosen}
        revealed={answered}
        onChoose={answer}
      />
      {answered && (
        <div className="mt-4 rounded-lg border border-navy-700 bg-navy-900/60 p-4">
          <h3
            className={
              chosen === problem.answer
                ? "font-semibold text-good"
                : "font-semibold text-bad"
            }
          >
            {chosen === problem.answer ? "Correct!" : "Not quite."} Answer:{" "}
            {"ABCDE"[problem.answer ?? 0]}
          </h3>
          {problem.solution && (
            <details className="mt-2" open={chosen !== problem.answer}>
              <summary className="cursor-pointer text-sm font-medium text-accent-bright">
                Solution
              </summary>
              <div className="mt-2 text-sm leading-relaxed text-ink-dim">
                <Latex text={problem.solution} />
              </div>
            </details>
          )}
          <p className="mt-3 flex items-center gap-1 text-xs text-ink-faint">
            <Badge tone="accent">AI-generated</Badge>
            <span>
              Practice problem — verify against official material for exam prep.
            </span>
          </p>
        </div>
      )}
    </ProblemView>
  );
}
