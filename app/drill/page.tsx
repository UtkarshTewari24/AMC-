"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DrillSession from "@/components/DrillSession";
import { Badge, Button, Card, cn } from "@/components/ui";
import { TOPICS, type Difficulty, type Topic } from "@/lib/types";

const DIFF_OPTIONS = ["easy", "medium", "hard", "all", "adaptive"] as const;

function DrillPageInner() {
  const params = useSearchParams();
  const topicParam = params.get("topic");
  const diffParam = params.get("difficulty");

  const started = Boolean(topicParam && diffParam);

  if (started) {
    const topic = (TOPICS as readonly string[]).includes(topicParam!)
      ? (topicParam as Topic)
      : "All";
    const difficulty = (DIFF_OPTIONS as readonly string[]).includes(diffParam!)
      ? (diffParam as Difficulty | "all" | "adaptive")
      : "all";
    return (
      <DrillSession
        key={`${topic}-${difficulty}`}
        topic={topic}
        difficulty={difficulty}
        mode="drill"
      />
    );
  }

  return <DrillSetup />;
}

function DrillSetup() {
  const [topic, setTopic] = useState<Topic | "All">("All");
  const [difficulty, setDifficulty] = useState<(typeof DIFF_OPTIONS)[number]>("all");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setCounts(d.bank?.byTopic ?? {}))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Topic Drill</h1>
      <p className="mt-1 text-ink-dim">
        Pick a topic and difficulty. Immediate feedback and the AI coach after
        every problem.
      </p>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Topic
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["All", ...TOPICS] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                topic === t
                  ? "border-accent bg-accent/15 text-accent-bright"
                  : "border-navy-600 text-ink-dim hover:border-accent-bright"
              )}
            >
              {t}
              {t !== "All" && counts[t] !== undefined && (
                <span className="ml-1.5 text-xs text-ink-faint">
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Difficulty
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIFF_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
                difficulty === d
                  ? "border-accent bg-accent/15 text-accent-bright"
                  : "border-navy-600 text-ink-dim hover:border-accent-bright"
              )}
            >
              {d}
            </button>
          ))}
        </div>
        {difficulty === "adaptive" && (
          <p className="mt-2 text-xs text-ink-faint">
            Adaptive tracks your rolling accuracy per topic and shifts
            difficulty up past 80% and down below 50%.
          </p>
        )}

        <div className="mt-8 flex items-center gap-3">
          <Link
            href={`/drill?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}`}
          >
            <Button size="lg">Start drilling</Button>
          </Link>
          <Badge>25 problems max · press A–E to answer</Badge>
        </div>
      </Card>
    </div>
  );
}

export default function DrillPage() {
  return (
    <Suspense>
      <DrillPageInner />
    </Suspense>
  );
}
