import { NextRequest, NextResponse } from "next/server";
import { getProblem, sampleProblems } from "@/lib/data";
import { aiFromRequest, aiErrorResponse, extractJson, textOf } from "@/lib/ai";
import { TOPICS, type Difficulty, type Topic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Generates fresh AMC 10-style problems similar to the bank. Returns strict
 * JSON so the client can render and solve them like real problems.
 */

interface GenBody {
  topic?: Topic | "All";
  difficulty?: Difficulty;
  count?: number;
  seedProblemId?: string;
}

interface GeneratedProblem {
  question: string;
  choices: string[];
  answer: number;
  solution: string;
  topic: string;
  difficulty: string;
}

const DIFF_GUIDE: Record<string, string> = {
  easy: "early-contest (problems 1-8): direct, one or two steps",
  medium: "mid-contest (problems 9-17): multi-step, a key insight",
  hard: "late-contest (problems 18-25): challenging, clever synthesis",
};

export async function POST(req: NextRequest) {
  let body: GenBody;
  try {
    body = (await req.json()) as GenBody;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const topic = body.topic && body.topic !== "All" ? body.topic : null;
  const difficulty = body.difficulty ?? "medium";
  const count = Math.min(Math.max(body.count ?? 3, 1), 5);

  // a few real examples to anchor style/format
  const seed = body.seedProblemId ? getProblem(body.seedProblemId) : undefined;
  const examples = seed
    ? [seed]
    : sampleProblems(
        { topic: topic ?? "All", difficulty },
        2
      );
  const exampleText = examples
    .map(
      (p, i) =>
        `Example ${i + 1} (${p.topic}, ${p.difficulty}):\nQuestion: ${p.question}\nChoices: ${p.choices
          .map((c, j) => `(${"ABCDE"[j]}) ${c}`)
          .join("  ")}\nCorrect: (${"ABCDE"[p.answer ?? 0]})`
    )
    .join("\n\n");

  const system = `You are an AMC 10 problem author. Write NEW, original competition problems in the exact style of the AMC 10 (American Mathematics Competitions, grade 10). Requirements:
- Each problem has exactly 5 answer choices (A-E), exactly one correct.
- Difficulty: ${DIFF_GUIDE[difficulty]}.
- ${topic ? `Topic: ${topic}.` : "Mixed topics appropriate for AMC 10."}
- Self-contained, unambiguous, solvable without a calculator, with an integer or clean closed-form answer.
- Do NOT copy the examples — invent new scenarios and numbers.
- Write all mathematics in LaTeX using $...$ inline delimiters (e.g. $\\frac{3}{4}$, $x^2$).
- The solution must be a clear, correct walkthrough ending in the answer.

Respond with ONLY a JSON array (no prose, no code fences) of ${count} objects with this exact shape:
[{"question": "<latex>", "choices": ["<A>","<B>","<C>","<D>","<E>"], "answer": <0-4 index of correct choice>, "solution": "<latex walkthrough>", "topic": "<one of the AMC topics>", "difficulty": "${difficulty}"}]`;

  try {
    const { client, model } = aiFromRequest(req);
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: "user",
          content: `Here are real reference problems for style:\n\n${exampleText}\n\nNow write ${count} brand-new AMC 10 problem(s). Return only the JSON array.`,
        },
      ],
    });

    const parsed = extractJson<GeneratedProblem[]>(textOf(response));
    const problems = (Array.isArray(parsed) ? parsed : [])
      .filter(
        (p) =>
          p &&
          typeof p.question === "string" &&
          Array.isArray(p.choices) &&
          p.choices.length === 5 &&
          typeof p.answer === "number" &&
          p.answer >= 0 &&
          p.answer <= 4
      )
      .map((p, i) => ({
        id: `gen-${Date.now()}-${i}`,
        year: new Date().getFullYear(),
        contest: "Generated",
        number: i + 1,
        topic: (TOPICS as readonly string[]).includes(p.topic)
          ? p.topic
          : topic ?? "Algebra",
        difficulty,
        question: p.question,
        choices: p.choices.map(String),
        answer: p.answer,
        solution: p.solution ?? "",
        has_diagram: false,
        diagram_url: null,
        aops_url: "",
      }));

    if (!problems.length) {
      return NextResponse.json(
        { error: "The model did not return usable problems. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ problems });
  } catch (error) {
    const { message, status } = aiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
