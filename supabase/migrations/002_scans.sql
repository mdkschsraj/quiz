-- QR scan tracking. Run after 001_init.sql.

create table scans (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id),
  visitor_id text not null,              -- anonymous cookie id, an estimate of unique scanners
  created_at timestamptz not null default now()
);
create index scans_center_time_idx on scans(center_id, created_at);
create index scans_visitor_idx on scans(center_id, visitor_id, created_at desc);
alter table scans enable row level security;

-- Per-center funnel used by the admin Centers page.
create or replace function center_stats()
returns table (
  center_id uuid,
  scans bigint,
  unique_scanners bigint,
  students_started bigint,
  students_finished bigint
)
language sql
stable
as $$
  select
    c.id,
    (select count(*) from scans s where s.center_id = c.id),
    (select count(distinct s.visitor_id) from scans s where s.center_id = c.id),
    (select count(distinct a.student_id) from attempts a where a.center_id = c.id),
    (select count(distinct a.student_id) from attempts a where a.center_id = c.id and a.status <> 'in_progress')
  from centers c;
$$;

revoke execute on function center_stats() from public, anon, authenticated;
grant execute on function center_stats() to service_role;
