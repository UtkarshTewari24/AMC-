#!/usr/bin/env node
/**
 * Re-tags problem topics using the Claude API (PRD step 4).
 *
 * The scraper assigns topics with a keyword heuristic and marks each tag's
 * confidence. This script sends every problem (or only low-confidence ones
 * with --low-only) to Claude for classification against the topic enum and
 * rewrites data/problems.json in place.
 *
 * Usage: ANTHROPIC_API_KEY=... node scripts/tag-topics-claude.mjs [--low-only]
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TOPICS = [
  "Algebra",
  "Geometry",
  "Number Theory",
  "Combinatorics",
  "Probability",
  "Sequences & Series",
  "Functions",
  "Trigonometry",
  "Logic & Word Problems",
];

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY to run the Claude topic tagger.");
  process.exit(1);
}

const lowOnly = process.argv.includes("--low-only");
const dataPath = path.join(process.cwd(), "data", "problems.json");
const problems = JSON.parse(readFileSync(dataPath, "utf-8"));
const targets = problems.filter(
  (p) => !lowOnly || p.topic_confidence === "low"
);
console.log(
  `Tagging ${targets.length}/${problems.length} problems with Claude…`
);

const client = new Anthropic();

const SYSTEM = `You classify AMC 10 competition problems by topic. Reply with STRICT JSON only: {"topic": <one of ${JSON.stringify(TOPICS)}>, "confidence": <"high"|"low">}. Pick the single dominant topic.`;

let updated = 0;
for (const p of targets) {
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${p.question}\n\nChoices: ${p.choices.join(" | ")}`,
        },
      ],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) continue;
    const parsed = JSON.parse(match[0]);
    if (TOPICS.includes(parsed.topic)) {
      if (p.topic !== parsed.topic) updated++;
      p.topic = parsed.topic;
      p.topic_confidence = parsed.confidence === "high" ? "high" : "low";
    }
  } catch (err) {
    console.error(`  ${p.year} ${p.contest} #${p.number}: ${err.message}`);
  }
}

writeFileSync(dataPath, JSON.stringify(problems, null, 1));
console.log(`Done — ${updated} topics changed. Wrote ${dataPath}`);
