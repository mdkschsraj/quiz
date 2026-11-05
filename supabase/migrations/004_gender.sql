-- Optional gender on students, used only for the admin student list filter. Run after 003.
alter table students add column if not exists gender text check (gender in ('male','female'));
create index if not exists attempts_started_idx on attempts(started_at);
