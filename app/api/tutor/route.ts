import { NextRequest, NextResponse } from "next/server";
import { getProblem } from "@/lib/data";
import { aiFromRequest, aiErrorResponse, extractJson, textOf } from "@/lib/ai";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Produces a structured tutoring guide for a topic (and optionally anchored
 * to a specific problem). Returns JSON for clean, KaTeX-rendered sections.
 */

interface TutorBody {
  topic?: Topic;
  problemId?: string;
}

interface TutorGuide {
  title: string;
  overview: string;
  concepts: { name: string; explanation: string }[];
  techniques: { name: string; when: string }[];
  worked_example: { problem: string; steps: string[] };
  pitfalls: string[];
  next_steps: string[];
}

export async function POST(req: NextRequest) {
  let body: TutorBody;
  try {
    body = (await req.json()) as TutorBody;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const problem = body.problemId ? getProblem(body.problemId) : undefined;
  const topic = body.topic ?? problem?.topic ?? "Algebra";

  const anchor = problem
    ? `Anchor the guide to this specific AMC 10 problem the student is working on:\nQuestion: ${problem.question}\nChoices: ${problem.choices
        .map((c, i) => `(${"ABCDE"[i]}) ${c}`)
        .join("  ")}\nThe correct answer is (${"ABCDE"[problem.answer ?? 0]}). Use it as the worked example, but teach the general method so it transfers.`
    : `Give a general tutoring guide for AMC 10 ${topic} problems.`;

  const system = `You are an expert AMC 10 tutor. Produce a focused, encouraging tutoring guide for the topic "${topic}". Teach the standard competition techniques a strong high-schooler needs. Write all math in $...$ LaTeX. Be concrete and concise — no filler.

Respond with ONLY a JSON object (no prose, no code fences) of this exact shape:
{
  "title": "<short title>",
  "overview": "<2-3 sentence orientation to the topic>",
  "concepts": [{"name": "<concept>", "explanation": "<1-2 sentences with $LaTeX$>"}],
  "techniques": [{"name": "<technique, e.g. complementary counting>", "when": "<when to reach for it>"}],
  "worked_example": {"problem": "<a representative problem statement in $LaTeX$>", "steps": ["<step 1>", "<step 2>", "..."]},
  "pitfalls": ["<common mistake>", "..."],
  "next_steps": ["<what to practice next>", "..."]
}
Include 3-5 concepts, 3-5 techniques, 3-6 worked-example steps, 2-4 pitfalls, 2-4 next steps.`;

  try {
    const { client, model } = aiFromRequest(req);
    const response = await client.messages.create({
      model,
      max_tokens: 3072,
      system,
      messages: [{ role: "user", content: anchor }],
    });
    const guide = extractJson<TutorGuide>(textOf(response));
    return NextResponse.json({ guide });
  } catch (error) {
    const { message, status } = aiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
