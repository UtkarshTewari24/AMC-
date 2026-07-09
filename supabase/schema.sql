-- AMC 10 Trainer — Supabase schema
-- Run in the Supabase SQL editor (or `supabase db push`), then seed the
-- problem bank with `npm run seed`.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------- problems
create table if not exists public.problems (
  id           uuid primary key,
  year         int  not null check (year between 2000 and 2100),
  contest      text not null,               -- 'AMC10' | 'AMC10A' | 'AMC10B' | 'AMC10A Fall' | 'AMC10B Fall'
  number       int  not null check (number between 1 and 25),
  topic        text not null check (topic in (
                 'Algebra','Geometry','Number Theory','Combinatorics',
                 'Probability','Sequences & Series','Functions',
                 'Trigonometry','Logic & Word Problems')),
  difficulty   text not null check (difficulty in ('easy','medium','hard')),
  question     text not null,               -- raw LaTeX string
  choices      text[] not null,             -- 5 LaTeX strings (A-E)
  answer       int check (answer between 0 and 4),  -- 0-indexed correct choice
  solution     text,                        -- LaTeX walkthrough
  has_diagram  boolean not null default false,
  diagram_url  text,
  aops_url     text not null,
  unique (year, contest, number)
);

create index if not exists problems_topic_idx on public.problems (topic, difficulty);
create index if not exists problems_contest_idx on public.problems (year, contest);

-- ------------------------------------------------------------------- users
-- Extends Supabase auth; row is created on first sync from the client.
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  streak       int   not null default 0,
  total_solved int   not null default 0,
  accuracy     float not null default 0,
  topic_stats  jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------- user_attempts
create table if not exists public.user_attempts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  problem_id   uuid not null references public.problems (id) on delete cascade,
  session_id   text,                        -- groups attempts into a test/drill session
  chosen       int check (chosen between 0 and 4),  -- null = skipped
  correct      boolean not null,
  time_spent   int not null default 0,      -- seconds
  created_at   timestamptz not null default now()
);

create index if not exists user_attempts_user_idx
  on public.user_attempts (user_id, created_at desc);

-- ------------------------------------------------------------------- RLS
alter table public.problems      enable row level security;
alter table public.users         enable row level security;
alter table public.user_attempts enable row level security;

-- everyone (including anon) can read problems
drop policy if exists "problems are readable by all" on public.problems;
create policy "problems are readable by all"
  on public.problems for select
  using (true);

-- users can only see and manage their own profile row
drop policy if exists "users read own profile" on public.users;
create policy "users read own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users upsert own profile" on public.users;
create policy "users upsert own profile"
  on public.users for insert
  with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.users;
create policy "users update own profile"
  on public.users for update
  using (auth.uid() = id);

-- users can only read/write their own attempts
drop policy if exists "attempts readable by owner" on public.user_attempts;
create policy "attempts readable by owner"
  on public.user_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "attempts insertable by owner" on public.user_attempts;
create policy "attempts insertable by owner"
  on public.user_attempts for insert
  with check (auth.uid() = user_id);
