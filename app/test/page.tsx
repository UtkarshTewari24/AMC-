"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timer } from "lucide-react";
import TestSession from "@/components/TestSession";
import { Badge, Button, Card, cn } from "@/components/ui";

interface ContestRef {
  year: number;
  contest: string;
}

export default function TestPage() {
  const [contests, setContests] = useState<ContestRef[]>([]);
  const [pick, setPick] = useState<ContestRef | "random" | null>(null);
  const [started, setStarted] = useState<ContestRef | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setContests(d.contests ?? []))
      .catch(() => {});
  }, []);

  if (started) {
    return (
      <TestSession
        key={`${started.year}-${started.contest}`}
        year={started.year}
        contest={started.contest}
      />
    );
  }

  const start = () => {
    if (!pick) return;
    if (pick === "random") {
      const c = contests[Math.floor(Math.random() * contests.length)];
      if (c) setStarted(c);
    } else {
      setStarted(pick);
    }
  };

  const years = [...new Set(contests.map((c) => c.year))].sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Timer className="h-6 w-6 text-accent-bright" /> Full Practice Test
      </h1>
      <p className="mt-1 text-ink-dim">
        A complete 25-question AMC 10 under the official 75-minute clock. No
        feedback until you submit. Scored +6 per correct answer (max 150).
      </p>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
            Pick a contest
          </h2>
          <button
            onClick={() => setPick("random")}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              pick === "random"
                ? "border-accent bg-accent/15 text-accent-bright"
                : "border-navy-600 text-ink-dim hover:border-accent-bright"
            )}
          >
            Random year
          </button>
        </div>

        {contests.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">
            Loading contest list…
          </p>
        ) : (
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {years.map((year) => (
              <div key={year} className="flex items-center gap-2">
                <span className="w-12 font-mono text-sm text-ink-faint">
                  {year}
                </span>
                {contests
                  .filter((c) => c.year === year)
                  .map((c) => (
                    <button
                      key={c.contest}
                      onClick={() => setPick(c)}
                      className={cn(
                        "rounded-md border px-3 py-1 text-sm",
                        pick !== "random" &&
                          pick?.year === c.year &&
                          pick?.contest === c.contest
                          ? "border-accent bg-accent/15 text-accent-bright"
                          : "border-navy-600 text-ink-dim hover:border-accent-bright"
                      )}
                    >
                      {c.contest}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button size="lg" disabled={!pick} onClick={start}>
            Start test
          </Button>
          <Badge>75:00 on the clock</Badge>
          <Link href="/" className="ml-auto text-sm text-ink-faint hover:text-ink">
            Back
          </Link>
        </div>
      </Card>
    </div>
  );
}
