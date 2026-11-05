-- Draws. Run after 001 and 002.
-- A draw has a date range, one or more score groups, and stored winners.
-- Eligibility is computed when the draw runs, from quiz submissions inside the range.

create table draws (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  allow_multi_group_wins boolean not null default false,  -- one student may win in several groups
  allow_previous_winners boolean not null default false,  -- winners of earlier draws may win again
  status text not null default 'draft' check (status in ('draft','drawing','drawn','published')),
  drawn_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table draw_groups (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  name text not null,
  min_percent int not null default 100 check (min_percent between 1 and 100), -- 100 = all answers correct (10/10)
  winners_count int not null check (winners_count between 1 and 1000),
  prize text not null default '',
  eligible_count int,                    -- size of the pool at draw time, for the audit trail
  created_at timestamptz not null default now()
);

-- Snapshot of everyone who was in the pool (their best attempt inside the date range).
create table draw_entries (
  draw_id uuid not null references draws(id) on delete cascade,
  student_id uuid not null references students(id),
  attempt_id uuid not null references attempts(id),
  score int not null,
  total int not null,
  primary key (draw_id, student_id)
);

create table draw_winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  group_id uuid not null references draw_groups(id) on delete cascade,
  student_id uuid not null references students(id),
  attempt_id uuid not null references attempts(id),
  score int not null,
  total int not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (draw_id, group_id, student_id)
);
create index draw_winners_student_idx on draw_winners(student_id);
create index draw_winners_draw_idx on draw_winners(draw_id);

alter table draws enable row level security;
alter table draw_groups enable row level security;
alter table draw_entries enable row level security;
alter table draw_winners enable row level security;
