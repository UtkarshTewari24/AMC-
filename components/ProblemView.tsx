"use client";

import { useEffect } from "react";
import Latex from "./Latex";
import { Badge, cn } from "./ui";
import type { Problem } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E"];

export function ProblemHeader({ problem }: { problem: Problem }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono text-ink-dim">
        {problem.year} {problem.contest} · #{problem.number}
      </span>
      <Badge tone="accent">{problem.topic}</Badge>
      <Badge
        tone={
          problem.difficulty === "easy"
            ? "good"
            : problem.difficulty === "medium"
              ? "warn"
              : "bad"
        }
      >
        {problem.difficulty}
      </Badge>
    </div>
  );
}

export function Choices({
  problem,
  chosen,
  revealed,
  onChoose,
  disabled,
}: {
  problem: Problem;
  chosen: number | null;
  revealed: boolean;
  onChoose: (idx: number) => void;
  disabled?: boolean;
}) {
  // keyboard shortcuts A-E
  useEffect(() => {
    if (disabled || revealed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const idx = LETTERS.indexOf(e.key.toUpperCase());
      if (idx !== -1) {
        e.preventDefault();
        onChoose(idx);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, revealed, onChoose]);

  return (
    <div className="grid gap-2">
      {problem.choices.map((choice, i) => {
        const isAnswer = revealed && i === problem.answer;
        const isWrongPick = revealed && chosen === i && i !== problem.answer;
        return (
          <button
            key={i}
            disabled={disabled || revealed}
            onClick={() => onChoose(i)}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
              "border-navy-700 bg-navy-900/60 hover:border-accent-bright hover:bg-navy-800",
              chosen === i && !revealed && "border-accent bg-accent/10",
              isAnswer && "border-good bg-good/10",
              isWrongPick && "border-bad bg-bad/10",
              (disabled || revealed) && "cursor-default hover:bg-navy-900/60"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-sm border",
                isAnswer
                  ? "border-good text-good"
                  : isWrongPick
                    ? "border-bad text-bad"
                    : chosen === i
                      ? "border-accent text-accent-bright"
                      : "border-navy-600 text-ink-dim"
              )}
            >
              {LETTERS[i]}
            </span>
            <Latex text={choice} math className="min-w-0" />
          </button>
        );
      })}
    </div>
  );
}

export default function ProblemView({
  problem,
  children,
}: {
  problem: Problem;
  children?: React.ReactNode;
}) {
  return (
    <div className="problem-card p-6">
      <ProblemHeader problem={problem} />
      <div className="mt-4 text-[1.02rem] leading-relaxed">
        <Latex text={problem.question} />
      </div>
      {problem.has_diagram && problem.diagram_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={problem.diagram_url}
          alt="Problem diagram"
          className="mt-4 max-h-72 rounded-lg bg-white/95 p-2"
        />
      )}
      <div className="mt-5">{children}</div>
    </div>
  );
}
