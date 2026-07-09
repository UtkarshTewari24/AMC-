import { NextResponse } from "next/server";
import { getProblem } from "@/lib/data";

export const dynamic = "force-dynamic";

export function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const problem = getProblem(params.id);
  if (!problem) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ problem });
}
