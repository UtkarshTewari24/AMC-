"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";
import { Badge, Button, Card, cn } from "@/components/ui";
import {
  DEFAULT_MODEL,
  MODELS,
  getApiKey,
  getModel,
  setApiKey,
  setModel,
} from "@/lib/settings";

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [model, setModelState] = useState<string>(DEFAULT_MODEL);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setKey(getApiKey());
    setModelState(getModel());
  }, []);

  const save = () => {
    setApiKey(key);
    setModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    // persist first so the request uses the entered key
    setApiKey(key);
    setModel(model);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anthropic-key": key.trim(),
          "x-anthropic-model": model,
        },
        body: JSON.stringify({ topic: "Algebra" }),
      });
      const data = await res.json();
      if (res.ok && data.guide) {
        setTestResult("✓ Connected — your key works.");
      } else {
        setTestResult("✗ " + (data.error ?? "Request failed."));
      }
    } catch {
      setTestResult("✗ Network error.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <KeyRound className="h-6 w-6 text-accent-bright" /> Settings
      </h1>
      <p className="mt-1 text-ink-dim">
        Add your Anthropic API key to unlock the AI features — coach, problem
        generator, tutor, and personalized study plans.
      </p>

      <Card className="mt-6">
        <label className="text-sm font-semibold">Anthropic API key</label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-..."
              className="h-10 w-full rounded-lg border border-navy-600 bg-navy-950 px-3 pr-10 font-mono text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Stored only in this browser (localStorage). It&apos;s sent to this
          app&apos;s own API routes to call Claude on your behalf — never saved
          on the server, and no problem content or messages are logged. Get a
          key at{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-accent-bright hover:underline"
          >
            console.anthropic.com
          </a>
          .
        </p>

        <label className="mt-6 block text-sm font-semibold">Model</label>
        <div className="mt-2 grid gap-2">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModelState(m.id)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                model === m.id
                  ? "border-accent bg-accent/10"
                  : "border-navy-600 hover:border-accent-bright"
              )}
            >
              <span>
                <span className="font-medium">{m.label}</span>
                <span className="ml-2 text-xs text-ink-faint">{m.note}</span>
              </span>
              {model === m.id && <Check className="h-4 w-4 text-accent-bright" />}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={save}>{saved ? "Saved!" : "Save"}</Button>
          <Button variant="outline" onClick={test} disabled={testing || !key.trim()}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {testResult && (
            <span
              className={cn(
                "text-sm",
                testResult.startsWith("✓") ? "text-good" : "text-bad"
              )}
            >
              {testResult}
            </span>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-accent-bright" /> What your key unlocks
        </h2>
        <div className="mt-3 grid gap-2 text-sm text-ink-dim sm:grid-cols-2">
          <Link href="/generate" className="rounded-lg border border-navy-700 p-3 hover:border-accent">
            <div className="font-medium text-ink">Generate problems</div>
            New AMC-style questions with answers & solutions.
          </Link>
          <Link href="/tutor" className="rounded-lg border border-navy-700 p-3 hover:border-accent">
            <div className="font-medium text-ink">Tutor guide</div>
            Structured teaching for any topic.
          </Link>
          <Link href="/plan" className="rounded-lg border border-navy-700 p-3 hover:border-accent">
            <div className="font-medium text-ink">Study plan</div>
            A personalized plan from your stats & goals.
          </Link>
          <Link href="/drill" className="rounded-lg border border-navy-700 p-3 hover:border-accent">
            <div className="font-medium text-ink">AI coach</div>
            Socratic hints while you drill.
          </Link>
        </div>
        <p className="mt-3">
          <Badge>No key? Everything else still works — the bank, drills, and
          timed tests are fully offline.</Badge>
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          Want to sync progress across devices?{" "}
          <Link href="/auth" className="text-accent-bright hover:underline">
            Account &amp; sign-in →
          </Link>
        </p>
      </Card>
    </div>
  );
}
