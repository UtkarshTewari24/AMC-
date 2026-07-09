# AMC 10 Trainer

A web app for high school students grinding for the AMC 10. **1,248 real
problems across all 50 AMC 10 administrations** from 2000–2024 (both A and B
contests, the 2000/2001 single AMC 10, and the 2021 Fall A/B), scraped from
the AoPS wiki with choices, answers, and full solutions — plus topic drills,
random drills, full timed practice tests, adaptive difficulty, and an AI
coach. The committed dataset (`data/problems.json`) has answers for every
problem and solutions for all but one.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it — the app serves problems straight from `data/problems.json`
(committed to the repo), so it works with zero configuration. Progress is
saved in the browser (guest mode).

### AI features (v2): bring your own key

Open **Settings** in the app and paste your Anthropic API key (from
[console.anthropic.com](https://console.anthropic.com/settings/keys)) — it's
stored only in your browser and sent to the app's own API routes to call
Claude on your behalf (never persisted server-side; no content logged). Pick
a model (Sonnet 4.6 / Opus 4.8 / Haiku 4.5). That unlocks:

- **AI coach** — Socratic hints while you drill
- **Generate** (`/generate`) — brand-new AMC-style problems with answers &
  solutions you can solve inline
- **Tutor** (`/tutor`) — a structured teaching guide for any topic (concepts,
  techniques, worked example, pitfalls)
- **Study plan** (`/plan`) — a week-by-week plan generated from your own
  practice stats and goals, with one-click drill links

Alternatively, set a server-side `ANTHROPIC_API_KEY` in `.env.local` as a
fallback for all users. Without any key, everything else — the full problem
bank, drills, and timed tests — works fully offline.

```
ANTHROPIC_API_KEY=sk-ant-...   # optional server-side fallback
```

### Versions

`v1` is the offline-complete release (bank + drills + timed test + coach).
`v2` adds the bring-your-own-key AI features above. To roll back to v1:
`git reset --hard b2e318c` (also tagged `v1` locally).

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

It runs in CI because AoPS's WAF blocks datacenter/CI IP ranges. When a
direct fetch is refused the scraper transparently falls back to the
**Wayback Machine** (resolving each page's newest capture via the CDX index
and fetching the raw `id_` snapshot), so it works from any runner.

**Full dataset (recommended):** the sharded workflow
(`.github/workflows/scrape-full.yml`) splits all 50 contests across 10
parallel jobs, uploads each shard as an artifact, then merges them into
`data/problems.json`. Trigger it from the Actions tab, or push a change to
`scripts/scrape-full-request.json`. End-to-end wall-clock is ~30 minutes.

- If a shard run's merge step fails but the shards succeeded, re-merge the
  existing artifacts without re-scraping via
  `.github/workflows/merge-artifacts.yml` (push a `scripts/merge-request.json`
  with `{"run_id": <shard run id>}`).
- The single-job `scrape.yml` handles quick `fixtures`/`test` runs and
  commits `data/problems.sample.json`.

**Locally** (only where AoPS or archive.org is reachable):
`pip install requests beautifulsoup4 cloudscraper && python
scripts/scrape.py --mode full` (~45 minutes with the polite 500 ms delay).

Modes: `fixtures` (cache raw HTML), `parse-fixtures` (offline parse), `test`
(one contest), `full` (all 50 contests; add `--shard-index I --shard-count
N` for one shard), `merge` (combine `data/shards/*.json`).

Optional: `scripts/tag-topics-claude.mjs` re-tags topics with the Claude API
(the keyword tagger flags ~half the problems as low-confidence).

## Stack

Next.js 14 (App Router) · Tailwind CSS · KaTeX · Supabase (Postgres +
Auth, optional) · Claude API (`claude-sonnet-4-6`) via `/api/coach`
(server-side only — the key never reaches the client, and the route logs no
problem content or user messages).
