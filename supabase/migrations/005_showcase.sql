-- Trust and engagement features. Run after 004.
-- Live draw time, prize photos, winner photos with permission record, prize-delivered flag.

alter table draws add column if not exists draw_at timestamptz;   -- when the live draw happens

alter table draw_groups add column if not exists prize_image_path text;

alter table draw_winners add column if not exists photo_path text;
alter table draw_winners add column if not exists photo_consent boolean not null default false;
alter table draw_winners add column if not exists prize_delivered_at timestamptz;

-- Public bucket for prize and winner photos. Files are uploaded only by the server (service role);
-- anyone can view a file if they have its link, which is what the public pages use.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-photos', 'campaign-photos', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create index if not exists draws_next_idx on draws(draw_at) where status = 'draft';

notify pgrst, 'reload schema';
