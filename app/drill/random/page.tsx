"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DrillSession from "@/components/DrillSession";
import type { Difficulty } from "@/lib/types";

function RandomDrillInner() {
  const params = useSearchParams();
  const diffParam = params.get("difficulty") ?? "all";
  const difficulty = (["easy", "medium", "hard", "all", "adaptive"].includes(
    diffParam
  )
    ? diffParam
    : "all") as Difficulty | "all" | "adaptive";

  return (
    <DrillSession
      key={difficulty}
      topic="All"
      difficulty={difficulty}
      mode="random"
    />
  );
}

export default function RandomDrillPage() {
  return (
    <Suspense>
      <RandomDrillInner />
    </Suspense>
  );
}
