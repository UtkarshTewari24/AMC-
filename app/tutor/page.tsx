"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Lightbulb } from "lucide-react";
import Latex from "@/components/Latex";
import { Badge, Button, Card, cn } from "@/components/ui";
import { aiHeaders, hasApiKey } from "@/lib/settings";
import { TOPICS, type Topic } from "@/lib/types";

interface TutorGuide {
  title: string;
  overview: string;
  concepts: { name: string; explanation: string }[];
  techniques: { name: string; when: string }[];
  worked_example: { problem: string; steps: string[] };
  pitfalls: string[];
  next_steps: string[];
}

export default function TutorPage() {
  const [topic, setTopic] = useState<Topic>("Algebra");
  const [guide, setGuide] = useState<TutorGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (t: Topic) => {
    setTopic(t);
    setLoading(true);
    setError(null);
    setGuide(null);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to build the guide.");
      else setGuide(data.guide);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <GraduationCap className="h-6 w-6 text-accent-bright" /> Tutor guide
      </h1>
      <p className="mt-1 text-ink-dim">
        Get a focused teaching guide for any AMC 10 topic — key concepts,
        standard techniques, a worked example, and common pitfalls.
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
          {TOPICS.map((t) => (
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
        <div className="mt-5">
          <Button onClick={() => load(topic)} disabled={loading || !hasApiKey()}>
            <Lightbulb className="h-4 w-4" />
            {loading ? "Teaching…" : `Teach me ${topic}`}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </Card>

      {loading && (
        <Card className="mt-4 animate-pulse py-16 text-center text-ink-faint">
          Preparing your guide…
        </Card>
      )}

      {guide && (
        <div className="mt-6 space-y-4">
          <Card>
            <h2 className="text-xl font-bold text-accent-bright">
              {guide.title}
            </h2>
            <p className="mt-2 text-ink-dim">
              <Latex text={guide.overview} />
            </p>
          </Card>

          <Section title="Key concepts">
            <div className="space-y-3">
              {guide.concepts?.map((c, i) => (
                <div key={i}>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-ink-dim">
                    <Latex text={c.explanation} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Standard techniques">
            <div className="space-y-2">
              {guide.techniques?.map((t, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <Badge tone="accent">{t.name}</Badge>
                  <span className="text-ink-dim">
                    <Latex text={t.when} />
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {guide.worked_example && (
            <Section title="Worked example">
              <div className="text-sm">
                <Latex text={guide.worked_example.problem} />
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-dim">
                {guide.worked_example.steps?.map((s, i) => (
                  <li key={i}>
                    <Latex text={s} />
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Section title="Common pitfalls">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-dim">
              {guide.pitfalls?.map((p, i) => (
                <li key={i}>
                  <Latex text={p} />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What to practice next">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-dim">
              {guide.next_steps?.map((s, i) => (
                <li key={i}>
                  <Latex text={s} />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Link href={`/drill?topic=${encodeURIComponent(topic)}&difficulty=adaptive`}>
                <Button size="sm">Drill {topic} now</Button>
              </Link>
              <Link href={`/generate`}>
                <Button size="sm" variant="outline">
                  Generate practice
                </Button>
              </Link>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </Card>
  );
}
