begin;
-- Additive: does not recreate or change the working 7I.1 video tables.
create table if not exists public.swing_video_annotations (
  video_id uuid not null references public.swing_videos(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  document jsonb not null default '{"version":1,"shapes":[],"note":""}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (video_id, author_id),
  check (jsonb_typeof(document) = 'object'),
  check (octet_length(document::text) <= 100000)
);
alter table public.swing_video_annotations enable row level security;
drop policy if exists "participants read video annotations" on public.swing_video_annotations;
create policy "participants read video annotations" on public.swing_video_annotations
for select to authenticated using (
  exists (
    select 1 from public.swing_videos sv where sv.id = swing_video_annotations.video_id
    and sv.status <> 'archived'
    and (sv.player_id = auth.uid() or exists (
      select 1 from public.coach_player_links cpl
      join public.profiles p on p.id = cpl.coach_id
      where cpl.coach_id = auth.uid() and cpl.player_id = sv.player_id
        and p.role in ('coach', 'admin')
    ))
  )
);
-- Writes pass through the authenticated API for validation and revision checks.
revoke all on public.swing_video_annotations from anon, authenticated;
grant select on public.swing_video_annotations to authenticated;
grant all on public.swing_video_annotations to service_role;
commit;
