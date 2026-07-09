import { NextRequest, NextResponse } from "next/server";
import { aiFromRequest, aiErrorResponse, extractJson, textOf } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Generates a personalized AMC 10 study plan from the student's own practice
 * stats (sent from the client's localStorage progress) plus their goals.
 */

interface TopicStat {
  solved: number;
  correct: number;
}

interface PlanBody {
  stats?: {
    totalSolved?: number;
    accuracy?: number;
    streak?: number;
    byTopic?: Record<string, TopicStat>;
  };
  goal?: {
    testDate?: string; // ISO or free text
    hoursPerWeek?: number;
    targetScore?: number; // 0-150
    notes?: string;
  };
}

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

export async function POST(req: NextRequest) {
  let body: PlanBody;
  try {
    body = (await req.json()) as PlanBody;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const stats = body.stats ?? {};
  const goal = body.goal ?? {};

  const topicLines = Object.entries(stats.byTopic ?? {})
    .map(([t, s]) => {
      const acc = s.solved ? Math.round((s.correct / s.solved) * 100) : 0;
      return `- ${t}: ${s.correct}/${s.solved} correct (${acc}%)`;
    })
    .join("\n");

  const profile = `Student practice profile:
- Total problems solved: ${stats.totalSolved ?? 0}
- Overall accuracy: ${Math.round((stats.accuracy ?? 0) * 100)}%
- Current daily streak: ${stats.streak ?? 0}
Per-topic performance:
${topicLines || "- (no attempts yet)"}

Goals:
- Test date / timeframe: ${goal.testDate || "not specified"}
- Study time available: ${goal.hoursPerWeek ? `${goal.hoursPerWeek} hours/week` : "not specified"}
- Target score (out of 150): ${goal.targetScore ?? "not specified"}
- Notes: ${goal.notes || "none"}`;

  const system = `You are an expert AMC 10 coach building a personalized study plan. Use the student's real performance data to prioritize their weak topics while maintaining strengths. The app has topic drills (topic + difficulty: easy/medium/hard/adaptive), random drills, and full timed practice tests. Recommend concrete drills the app can run. Be realistic about the timeframe and hours available. Encourage but don't pad.

The AMC topics are: Algebra, Geometry, Number Theory, Combinatorics, Probability, Sequences & Series, Functions, Trigonometry, Logic & Word Problems.

Respond with ONLY a JSON object (no prose, no code fences) of this exact shape:
{
  "summary": "<2-3 sentence assessment + strategy>",
  "focus_areas": ["<weak topic to prioritize>", "..."],
  "weeks": [{
    "week": <number>,
    "theme": "<focus for the week>",
    "topics": ["<topic>", "..."],
    "goals": ["<measurable goal>", "..."],
    "recommended_drills": [{"topic": "<AMC topic or 'All'>", "difficulty": "easy|medium|hard|adaptive", "count": <int>}]
  }],
  "weekly_routine": ["<recurring habit>", "..."],
  "tips": ["<actionable tip>", "..."]
}
Produce between 3 and 8 weeks depending on the timeframe (default 4 if unspecified).`;

  try {
    const { client, model } = aiFromRequest(req);
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: profile }],
    });
    const plan = extractJson<StudyPlan>(textOf(response));
    return NextResponse.json({ plan });
  } catch (error) {
    const { message, status } = aiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
