-- College Quiz & Raffle: initial schema
-- All access goes through server routes using the service-role key.
-- RLS is enabled with no policies, so the public anon key can read nothing.

create extension if not exists "pgcrypto";

create table centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,            -- canonical form, e.g. 01712345678
  name text not null,                    -- original name, never silently overwritten
  name_conflict boolean not null default false, -- a later attempt used a different name
  created_at timestamptz not null default now()
);

create table campaign_weeks (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  quiz_duration_seconds int not null default 300 check (quiz_duration_seconds between 30 and 3600),
  questions_per_quiz int not null default 10 check (questions_per_quiz between 1 and 100),
  eligible_min_score int not null default 0,   -- used by the draw module later
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  options jsonb not null,                -- array of option strings, e.g. ["A","B","C","D"]
  correct_index smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  check (correct_index >= 0 and correct_index < jsonb_array_length(options))
);

create table attempts (
  id uuid primary key default gen_random_uuid(),   -- unguessable; acts as the attempt token
  student_id uuid not null references students(id),
  center_id uuid not null references centers(id),
  week_id uuid not null references campaign_weeks(id),
  submitted_name text not null,                    -- name typed on this attempt
  question_ids uuid[] not null,                    -- fixed random selection, in display order
  answers jsonb not null default '{}'::jsonb,      -- { "<question_id>": <option index> }
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired')),
  score int,
  total int
);
create index attempts_student_week_idx on attempts(student_id, week_id);
create index attempts_open_idx on attempts(expires_at) where status = 'in_progress';

-- One eligible entry per student per week. The unique constraint is the real guard.
create table entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  week_id uuid not null references campaign_weeks(id),
  attempt_id uuid not null references attempts(id),
  score int not null,
  total int not null,
  created_at timestamptz not null default now(),
  unique (student_id, week_id)
);

alter table centers enable row level security;
alter table students enable row level security;
alter table campaign_weeks enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
alter table entries enable row level security;
