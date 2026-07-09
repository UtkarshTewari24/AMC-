"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Target } from "lucide-react";
import Latex from "@/components/Latex";
import { Badge, Button, Card } from "@/components/ui";
import { overallStats, topicStats } from "@/lib/progress";
import { aiHeaders, hasApiKey } from "@/lib/settings";

interface StudyPlan {
  summary: string;
  focus_areas: string[];
  weeks: {
    week: number;
    theme: string;
    topics: string[];
    goals: string[];
    recommended_drills: { topic: string; difficulty: string; count: number }[];
  }[];
  weekly_routine: string[];
  tips: string[];
}

export default function PlanPage() {
  const [testDate, setTestDate] = useState("");
  const [hours, setHours] = useState(5);
  const [target, setTarget] = useState(100);
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof overallStats> | null>(
    null
  );

  useEffect(() => {
    setStats(overallStats());
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          stats: {
            totalSolved: stats?.totalSolved,
            accuracy: stats?.accuracy,
            streak: stats?.streak,
            byTopic: topicStats(),
          },
          goal: {
            testDate,
            hoursPerWeek: hours,
            targetScore: target,
            notes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to build the plan.");
      else setPlan(data.plan);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Target className="h-6 w-6 text-accent-bright" /> Personal study plan
      </h1>
      <p className="mt-1 text-ink-dim">
        A week-by-week plan built from your own practice stats and goals.
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
        {stats && (
          <p className="mb-4 text-sm text-ink-faint">
            Using your history: {stats.totalSolved} solved ·{" "}
            {Math.round(stats.accuracy * 100)}% accuracy · {stats.streak}d streak.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-ink-faint">Test date / timeframe</span>
            <input
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              placeholder="e.g. Nov 2026 or 6 weeks"
              className="mt-1 h-10 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="text-sm">
            <span className="text-ink-faint">Hours / week</span>
            <input
              type="number"
              min={1}
              max={40}
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value) || 5)}
              className="mt-1 h-10 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="text-sm">
            <span className="text-ink-faint">Target score /150</span>
            <input
              type="number"
              min={0}
              max={150}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value) || 100)}
              className="mt-1 h-10 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="text-ink-faint">Anything else? (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. geometry is my weakness, I want to peak by the exam"
            className="mt-1 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 py-2 text-sm outline-none focus:border-accent"
            rows={2}
          />
        </label>
        <div className="mt-5">
          <Button onClick={generate} disabled={loading || !hasApiKey()}>
            <CalendarDays className="h-4 w-4" />
            {loading ? "Building your plan…" : "Build my plan"}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </Card>

      {loading && (
        <Card className="mt-4 animate-pulse py-16 text-center text-ink-faint">
          Analyzing your stats and drafting a plan…
        </Card>
      )}

      {plan && (
        <div className="mt-6 space-y-4">
          <Card>
            <p className="text-ink-dim">
              <Latex text={plan.summary} />
            </p>
            {plan.focus_areas?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-sm text-ink-faint">Focus:</span>
                {plan.focus_areas.map((f, i) => (
                  <Badge key={i} tone="warn">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {plan.weeks?.map((w) => (
            <Card key={w.week}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 font-mono text-sm text-accent-bright">
                  {w.week}
                </span>
                <h3 className="font-semibold">{w.theme}</h3>
                <div className="ml-auto flex flex-wrap gap-1">
                  {w.topics?.map((t, i) => (
                    <Badge key={i}>{t}</Badge>
                  ))}
                </div>
              </div>
              {w.goals?.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-dim">
                  {w.goals.map((g, i) => (
                    <li key={i}>
                      <Latex text={g} />
                    </li>
                  ))}
                </ul>
              )}
              {w.recommended_drills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {w.recommended_drills.map((d, i) => (
                    <Link
                      key={i}
                      href={`/drill?topic=${encodeURIComponent(
                        d.topic
                      )}&difficulty=${encodeURIComponent(d.difficulty)}`}
                      className="rounded-md border border-navy-600 px-2.5 py-1 text-xs text-ink-dim hover:border-accent-bright hover:text-accent-bright"
                    >
                      Drill: {d.topic} · {d.difficulty} · {d.count}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          ))}

          {plan.weekly_routine?.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
                Weekly routine
              </h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-dim">
                {plan.weekly_routine.map((r, i) => (
                  <li key={i}>
                    <Latex text={r} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {plan.tips?.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
                Tips
              </h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-dim">
                {plan.tips.map((t, i) => (
                  <li key={i}>
                    <Latex text={t} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
