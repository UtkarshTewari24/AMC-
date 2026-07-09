#!/usr/bin/env node
/**
 * Seeds data/problems.json into the Supabase `problems` table.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 *
 * Requires the service-role key (RLS allows public reads only). Run
 * supabase/schema.sql first.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to seed."
  );
  process.exit(1);
}

const dataPath = ["problems.json", "problems.sample.json"]
  .map((f) => path.join(process.cwd(), "data", f))
  .find(existsSync);
if (!dataPath) {
  console.error("No data/problems.json found — run the scraper first.");
  process.exit(1);
}

const problems = JSON.parse(readFileSync(dataPath, "utf-8")).filter(
  (p) => p.question && p.choices?.length === 5 && p.answer !== null
);

const rows = problems.map((p) => ({
  id: p.id,
  year: p.year,
  contest: p.contest,
  number: p.number,
  topic: p.topic,
  difficulty: p.difficulty,
  question: p.question,
  choices: p.choices,
  answer: p.answer,
  solution: p.solution,
  has_diagram: p.has_diagram,
  diagram_url: p.diagram_url,
  aops_url: p.aops_url,
}));

const supabase = createClient(url, key);

console.log(`Seeding ${rows.length} problems from ${dataPath}…`);
for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200);
  const { error } = await supabase
    .from("problems")
    .upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`Batch ${i / 200 + 1} failed:`, error.message);
    process.exit(1);
  }
  console.log(`  upserted ${Math.min(i + 200, rows.length)}/${rows.length}`);
}
console.log("Done.");
