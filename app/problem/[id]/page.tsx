import { notFound } from "next/navigation";
import { getProblem } from "@/lib/data";
import SingleProblem from "./SingleProblem";

export const dynamic = "force-dynamic";

export default function ProblemPage({ params }: { params: { id: string } }) {
  const problem = getProblem(params.id);
  if (!problem) notFound();
  return <SingleProblem problem={problem} />;
}
