"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import CoachPanel from "@/components/CoachPanel";
import Latex from "@/components/Latex";
import ProblemView, { Choices } from "@/components/ProblemView";
import { Card } from "@/components/ui";
import { newSessionId, recordAttempt } from "@/lib/progress";
import { syncAttempt } from "@/lib/supabase/sync";
import type { Problem } from "@/lib/types";

export default function SingleProblem({ problem }: { problem: Problem }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [autoFire, setAutoFire] = useState<"correct" | "wrong" | null>(null);
  const [startedAt] = useState(Date.now());

  const answer = (idx: number) => {
    if (answered) return;
    const isCorrect = idx === problem.answer;
    const attempt = {
      problemId: problem.id,
      sessionId: newSessionId(),
      chosen: idx,
      correct: isCorrect,
      timeSpent: Math.round((Date.now() - startedAt) / 1000),
      topic: problem.topic,
      difficulty: problem.difficulty,
      createdAt: Date.now(),
    };
    recordAttempt(attempt);
    void syncAttempt(attempt);
    setChosen(idx);
    setAnswered(true);
    setAutoFire(isCorrect ? "correct" : "wrong");
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <ProblemView problem={problem}>
          <Choices
            problem={problem}
            chosen={chosen}
            revealed={answered}
            onChoose={answer}
          />
        </ProblemView>
        {answered && problem.solution && (
          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <h3
                className={
                  chosen === problem.answer
                    ? "font-semibold text-good"
                    : "font-semibold text-bad"
                }
              >
                {chosen === problem.answer ? "Correct!" : "Not quite."}
              </h3>
              <a
                href={problem.aops_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-accent-bright"
              >
                View on AoPS <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-ink-dim">
              <Latex text={problem.solution} />
            </div>
          </Card>
        )}
      </div>
      <div className="h-[calc(100vh-8rem)] lg:sticky lg:top-20">
        <CoachPanel
          problem={problem}
          userAnswer={chosen}
          answered={answered}
          autoFire={autoFire}
        />
      </div>
    </div>
  );
}
