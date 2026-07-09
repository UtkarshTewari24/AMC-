import { NextRequest, NextResponse } from "next/server";
import { sampleProblems, filterProblems } from "@/lib/data";
import type { Difficulty, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const topic = (sp.get("topic") ?? "All") as Topic | "All";
  const difficulty = (sp.get("difficulty") ?? "all") as Difficulty | "all";
  const count = Math.min(parseInt(sp.get("count") ?? "25", 10) || 25, 50);
  const excludeIds = (sp.get("exclude") ?? "")
    .split(",")
    .filter(Boolean);
  const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : undefined;
  const contest = sp.get("contest") ?? undefined;

  if (year && contest) {
    // full contest, in problem order (practice test mode)
    const problems = filterProblems({ year, contest }).sort(
      (a, b) => a.number - b.number
    );
    return NextResponse.json({ problems });
  }

  let problems = sampleProblems({ topic, difficulty, excludeIds }, count);
  if (problems.length < count) {
    // not enough unseen problems at this filter — allow repeats
    problems = problems.concat(
      sampleProblems(
        { topic, difficulty, excludeIds: problems.map((p) => p.id) },
        count - problems.length
      )
    );
  }
  return NextResponse.json({ problems });
}
