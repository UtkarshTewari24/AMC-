# AMC 10 Trainer

A web app for high school students grinding for the AMC 10. Every AMC 10
problem from 2000–2024 (both A and B contests, including the 2000/2001 single
AMC 10 and the 2021 Fall administration), scraped from the AoPS wiki, with
topic drills, random drills, full timed practice tests, adaptive difficulty,
and an AI coach.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it — the app serves problems straight from `data/problems.json`
(committed to the repo), so it works with zero configuration. Progress is
saved in the browser (guest mode).

### Optional: AI coach

Set `ANTHROPIC_API_KEY` in `.env.local` to enable the AI coach (Socratic
hints on wrong answers, insights on correct ones, free-form chat). Without a
key the coach panel shows a setup notice and everything else keeps working.

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional: accounts + progress sync (Supabase)

1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Seed the problem bank:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
   ```
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

Email/password auth then appears at `/auth`; attempts sync to
`user_attempts` and aggregate stats to `users` (RLS: users read only their
own rows; problems are world-readable).

## Modes

| Route | Mode |
| --- | --- |
| `/` | Dashboard — streak, accuracy, per-topic coverage bars |
| `/drill` | Topic drill — pick topic + difficulty (`easy/medium/hard/all/adaptive`), one problem at a time, instant feedback + solution + coach |
| `/drill/random` | Random drill — fully mixed |
| `/test` | Full practice test — pick any real contest (or random year), 75-minute countdown, problem nav grid, no feedback until submit, AMC scoring (+6/correct, max 150) |
| `/results/[sessionId]` | Post-session results — score, accuracy, time per problem, topic breakdown, review links |
| `/problem/[id]` | Single problem view (shareable) |

Keyboard shortcuts: **A–E** to answer, **Enter/N** for next problem.

Adaptive difficulty (v1 rules): rolling accuracy over the last 10 attempts
per topic — above 80% shifts difficulty up, below 50% shifts down.

## Problem scraper

`scripts/scrape.py` scrapes every AMC 10 problem from the AoPS wiki:
question, choices (A–E), correct answer (from the answer key page), first
written solution, and geometry diagrams (downloaded to `public/diagrams/`).
Topics are auto-tagged with a keyword heuristic (low-confidence tags are
flagged in `topic_confidence` for later review); difficulty maps from
problem number (1–8 easy, 9–17 medium, 18–25 hard).

It runs in CI because AoPS requires normal internet egress:

- **GitHub Actions** (recommended): the "Scrape AMC 10 problems" workflow
  (`.github/workflows/scrape.yml`) — run it manually from the Actions tab
  with mode `full`, or push a change to `scripts/scrape-request.json`. The
  workflow commits `data/problems.json`, `data/scrape-report.json`, and
  diagrams back to the branch.
- **Locally**: `pip install requests beautifulsoup4 cloudscraper && python
  scripts/scrape.py --mode full` (~35–50 minutes with the polite 500 ms
  delay between requests).

Modes: `fixtures` (save raw HTML for parser development), `parse-fixtures`
(offline parse of the fixtures), `test` (one contest end-to-end), `full`
(all 50 contests, ~1250 problems).

## Stack

Next.js 14 (App Router) · Tailwind CSS · KaTeX · Supabase (Postgres +
Auth, optional) · Claude API (`claude-sonnet-4-6`) via `/api/coach`
(server-side only — the key never reaches the client, and the route logs no
problem content or user messages).
