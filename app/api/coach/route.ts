import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getProblem } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI coach endpoint. Server-side only — the Anthropic key never reaches the
 * client. Per PRD privacy note, this route does not log problem content or
 * user messages.
 */

const LETTERS = ["A", "B", "C", "D", "E"];

interface CoachRequest {
  problemId: string;
  userAnswer?: number | null; // index of picked choice, if answered
  // "hint" (before answering), "wrong" (auto-fire), "correct" (auto-fire),
  // or "chat" (free follow-up)
  intent?: "hint" | "wrong" | "correct" | "chat";
  messages?: { role: "user" | "assistant"; content: string }[];
}

function systemPrompt(): string {
  return `You are an AMC 10 coach helping a high school student practice competition math.

Rules you must always follow:
- Keep every reply under 120 words unless the student explicitly asks you to "show me the solution" or requests a full walkthrough.
- NEVER reveal the correct answer choice or final numeric answer until the student explicitly asks for the solution.
- Use the Socratic method: ask what they've tried, point at the key insight, nudge — don't lecture.
- Reference the topic's standard techniques when relevant (e.g. combinatorics: complementary counting, casework; geometry: similar triangles, power of a point; number theory: modular arithmetic).
- Write all math in $...$ KaTeX inline format, e.g. $\\frac{1}{2}$.
- Be encouraging but concise. No filler.`;
}

function contextBlock(
  problem: NonNullable<ReturnType<typeof getProblem>>,
  userAnswer: number | null | undefined
): string {
  const choices = problem.choices
    .map((c, i) => `(${LETTERS[i]}) $${c}$`)
    .join("  ");
  const picked =
    userAnswer !== null && userAnswer !== undefined
      ? `The student picked (${LETTERS[userAnswer]}), which is ${
          userAnswer === problem.answer ? "CORRECT" : "INCORRECT"
        }.`
      : "The student has not answered yet.";
  return `<problem year="${problem.year}" contest="${problem.contest}" number="${problem.number}" topic="${problem.topic}">
${problem.question}
Choices: ${choices}
Correct answer: (${LETTERS[problem.answer ?? 0]})
Official solution (for your reference — do not reveal unless asked): ${problem.solution ?? "n/a"}
</problem>
${picked}`;
}

const INTENT_PROMPTS: Record<string, string> = {
  hint: "Give me one hint to get started. Don't give away the method entirely — just a nudge.",
  wrong: "I got this one wrong. Give me ONE Socratic nudge toward the right approach. Do not reveal the answer.",
  correct:
    "I got this one right. In one sentence, tell me why this approach generalizes to similar problems.",
};

export async function POST(req: NextRequest) {
  let body: CoachRequest;
  try {
    body = (await req.json()) as CoachRequest;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const problem = body.problemId ? getProblem(body.problemId) : undefined;
  if (!problem) {
    return NextResponse.json({ error: "unknown problem" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply:
        "The AI coach isn't configured yet — set ANTHROPIC_API_KEY on the server to enable it. " +
        "In the meantime, the full solution is available below each problem after you answer.",
      configured: false,
    });
  }

  const client = new Anthropic();

  const history = (body.messages ?? [])
    .slice(-12) // bound context
    .map((m) => ({ role: m.role, content: m.content }));

  const intentPrompt =
    body.intent && body.intent !== "chat" ? INTENT_PROMPTS[body.intent] : null;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user" as const,
      content: contextBlock(problem, body.userAnswer),
    },
    {
      role: "assistant" as const,
      content:
        "Understood. I'm ready to coach on this problem without revealing the answer prematurely.",
    },
    ...history,
  ];
  if (intentPrompt) {
    messages.push({ role: "user", content: intentPrompt });
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "no user message" }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt(),
      messages,
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ reply, configured: true });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({
        reply: "The coach's API key looks invalid — check ANTHROPIC_API_KEY.",
        configured: false,
      });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({
        reply: "The coach is rate-limited right now — try again in a moment.",
        configured: true,
      });
    }
    return NextResponse.json(
      { error: "coach unavailable" },
      { status: 502 }
    );
  }
}
