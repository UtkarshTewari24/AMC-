"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Flame,
  Shuffle,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { overallStats, topicStats } from "@/lib/progress";
import { TOPICS } from "@/lib/types";

interface BankStats {
  total: number;
  contests: number;
  byTopic: Record<string, number>;
  byDifficulty: Record<string, number>;
}

export default function Dashboard() {
  const [bank, setBank] = useState<BankStats | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof overallStats> | null>(
    null
  );
  const [topics, setTopics] = useState<ReturnType<typeof topicStats>>({});

  useEffect(() => {
    setStats(overallStats());
    setTopics(topicStats());
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setBank(d.bank))
      .catch(() => {});
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Train for the <span className="text-accent-bright">AMC 10</span>
          </h1>
          <p className="mt-1 text-ink-dim">
            {bank
              ? `${bank.total.toLocaleString()} real problems from ${bank.contests} contests (2000–2024).`
              : "Loading problem bank…"}
          </p>
        </div>
        {stats && (
          <div className="flex gap-6 font-mono text-sm">
            <span className="flex items-center gap-1.5 text-warn">
              <Flame className="h-4 w-4" /> {stats.streak}d streak
            </span>
            <span className="flex items-center gap-1.5 text-ink-dim">
              <Target className="h-4 w-4" /> {stats.totalSolved} solved
            </span>
            <span className="flex items-center gap-1.5 text-good">
              <TrendingUp className="h-4 w-4" />{" "}
              {Math.round(stats.accuracy * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* mode select */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/drill" className="group">
          <Card className="h-full transition-colors group-hover:border-accent">
            <BookOpen className="h-6 w-6 text-accent-bright" />
            <h2 className="mt-3 font-semibold">Topic Drill</h2>
            <p className="mt-1 text-sm text-ink-dim">
              Focused practice on one topic with instant feedback, solutions,
              and the AI coach.
            </p>
          </Card>
        </Link>
        <Link href="/drill/random" className="group">
          <Card className="h-full transition-colors group-hover:border-accent">
            <Shuffle className="h-6 w-6 text-accent-bright" />
            <h2 className="mt-3 font-semibold">Random Drill</h2>
            <p className="mt-1 text-sm text-ink-dim">
              Fully mixed problems across all topics — great for warm-ups and
              late-stage prep.
            </p>
          </Card>
        </Link>
        <Link href="/test" className="group">
          <Card className="h-full transition-colors group-hover:border-accent">
            <Timer className="h-6 w-6 text-accent-bright" />
            <h2 className="mt-3 font-semibold">Full Practice Test</h2>
            <p className="mt-1 text-sm text-ink-dim">
              A real 25-question AMC 10 under the 75-minute clock, scored on
              the official scale.
            </p>
          </Card>
        </Link>
      </div>

      {/* topic coverage */}
      <Card className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Topic coverage</h2>
          <Badge>your accuracy per topic</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {TOPICS.map((t) => {
            const s = topics[t];
            const bankCount = bank?.byTopic[t] ?? 0;
            const acc = s && s.solved > 0 ? s.correct / s.solved : null;
            return (
              <Link
                key={t}
                href={`/drill?topic=${encodeURIComponent(t)}&difficulty=all`}
                className="block"
              >
                <div className="flex items-center justify-between text-sm">
                  <span>{t}</span>
                  <span className="font-mono text-xs text-ink-faint">
                    {s ? `${s.correct}/${s.solved}` : "—"}
                    {bankCount ? ` · ${bankCount} in bank` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-navy-800">
                  <div
                    className={
                      acc === null
                        ? "h-full bg-navy-600"
                        : acc >= 0.8
                          ? "h-full bg-good"
                          : acc >= 0.5
                            ? "h-full bg-warn"
                            : "h-full bg-bad"
                    }
                    style={{
                      width: acc === null ? "2%" : `${Math.max(acc * 100, 4)}%`,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
        {stats && stats.totalSolved === 0 && (
          <p className="mt-4 text-sm text-ink-faint">
            No attempts yet — start a drill and your per-topic accuracy will
            show up here.
          </p>
        )}
        <div className="mt-6">
          <Link href="/drill">
            <Button>Start practicing</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
