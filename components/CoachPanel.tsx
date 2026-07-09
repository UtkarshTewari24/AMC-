"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Send, Sparkles } from "lucide-react";
import Latex from "./Latex";
import { Button, cn } from "./ui";
import type { Problem } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachHandle {
  /** auto-fire on answer: intent = "correct" | "wrong" */
  fire: (intent: "correct" | "wrong", userAnswer: number) => void;
}

export default function CoachPanel({
  problem,
  userAnswer,
  answered,
  autoFire,
}: {
  problem: Problem | null;
  userAnswer: number | null;
  answered: boolean;
  /** set to "correct"/"wrong" right after an answer to auto-fire the coach */
  autoFire: "correct" | "wrong" | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firedFor = useRef<string | null>(null);

  // reset the chat when the problem changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [problem?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  const ask = async (
    intent: "hint" | "wrong" | "correct" | "chat",
    text?: string
  ) => {
    if (!problem || busy) return;
    const history = [...messages];
    if (text) {
      history.push({ role: "user", content: text });
      setMessages(history);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          userAnswer,
          intent,
          messages: history,
        }),
      });
      const data = await res.json();
      const reply: string =
        data.reply ?? "The coach hit a snag — try again in a moment.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "The coach hit a snag — try again in a moment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // auto-fire once per problem when an answer lands
  useEffect(() => {
    if (autoFire && problem && firedFor.current !== problem.id) {
      firedFor.current = problem.id;
      void ask(autoFire);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFire, problem?.id]);

  return (
    <aside className="flex h-full flex-col rounded-xl border border-navy-700 bg-navy-900/70">
      <div className="flex items-center gap-2 border-b border-navy-700 px-4 py-3">
        <Sparkles className="h-4 w-4 text-accent-bright" />
        <span className="text-sm font-semibold">AI Coach</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-faint">
          Socratic mode
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-ink-faint">
            {answered
              ? "Ask me anything about this problem — or ask for the full solution."
              : "Stuck? Ask for a hint. I won't spoil the answer."}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed",
              m.role === "assistant"
                ? "bg-navy-800 text-ink"
                : "ml-auto bg-accent/20 text-ink"
            )}
          >
            <Latex text={m.content} />
          </div>
        ))}
        {busy && (
          <div className="coach-typing flex gap-1 px-3 py-2 text-accent-bright">
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </div>
        )}
      </div>

      <div className="border-t border-navy-700 p-3">
        {!answered && (
          <Button
            variant="outline"
            size="sm"
            className="mb-2 w-full"
            disabled={busy || !problem}
            onClick={() => ask("hint", "Can I get a hint?")}
          >
            <Lightbulb className="h-3.5 w-3.5" /> Give me a hint
          </Button>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text) return;
            setInput("");
            void ask("chat", text);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              answered ? 'Ask, or say "show me the solution"' : "Ask the coach…"
            }
            className="h-9 flex-1 rounded-lg border border-navy-600 bg-navy-950 px-3 text-sm outline-none placeholder:text-ink-faint focus:border-accent"
          />
          <Button size="sm" className="h-9 px-3" disabled={busy || !input.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
