begin;

create type public.swing_video_status as enum (
  'waiting_for_upload', 'uploading', 'processing', 'ready', 'error', 'cancelled', 'archived'
);

create type public.swing_camera_view as enum ('down_the_line', 'face_on', 'rear', 'other');

create table public.swing_videos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  assigned_coach_id uuid references public.profiles(id) on delete set null,
  status public.swing_video_status not null default 'waiting_for_upload',
  title text,
  swing_type text not null check (swing_type in ('full_swing','pitching','chipping','bunker','putting')),
  camera_view public.swing_camera_view not null,
  club text not null check (char_length(club) between 1 and 60),
  handedness text check (handedness in ('right','left')),
  ball_flight text check (char_length(ball_flight) <= 240),
  player_question text check (char_length(player_question) <= 1000),
  recorded_at timestamptz,
  mux_upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text,
  mux_error_message text,
  duration_seconds numeric,
  aspect_ratio text,
  max_stored_resolution text,
  original_filename text,
  original_size_bytes bigint check (original_size_bytes is null or original_size_bytes between 1 and 524288000),
  original_mime_type text,
  review_requested_at timestamptz,
  reviewed_at timestamptz,
  retention_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index swing_videos_player_created_idx on public.swing_videos(player_id, created_at desc);
create index swing_videos_coach_queue_idx on public.swing_videos(assigned_coach_id, status, review_requested_at desc);
create index swing_videos_mux_upload_idx on public.swing_videos(mux_upload_id) where mux_upload_id is not null;

create table public.video_audit_events (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.swing_videos(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index video_audit_video_created_idx on public.video_audit_events(video_id, created_at desc);

create or replace function public.set_swing_video_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_swing_video_updated_at
before update on public.swing_videos
for each row execute function public.set_swing_video_updated_at();

alter table public.swing_videos enable row level security;
alter table public.video_audit_events enable row level security;

create policy "players insert own swing videos"
on public.swing_videos for insert to authenticated
with check (player_id = auth.uid() and uploaded_by = auth.uid());

create policy "players read own swing videos"
on public.swing_videos for select to authenticated
using (player_id = auth.uid());

create policy "players update own unreviewed swing videos"
on public.swing_videos for update to authenticated
using (player_id = auth.uid() and reviewed_at is null)
with check (player_id = auth.uid() and uploaded_by = auth.uid());

create policy "accepted coaches read linked player videos"
on public.swing_videos for select to authenticated
using (
  exists (
    select 1 from public.coach_player_links cpl
    where cpl.coach_id = auth.uid()
      and cpl.player_id = swing_videos.player_id
      and cpl.status = 'accepted'
  )
);

create policy "accepted coaches update linked player videos"
on public.swing_videos for update to authenticated
using (
  exists (
    select 1 from public.coach_player_links cpl
    where cpl.coach_id = auth.uid()
      and cpl.player_id = swing_videos.player_id
      and cpl.status = 'accepted'
  )
)
with check (
  exists (
    select 1 from public.coach_player_links cpl
    where cpl.coach_id = auth.uid()
      and cpl.player_id = swing_videos.player_id
      and cpl.status = 'accepted'
  )
);

create policy "participants read video audit"
on public.video_audit_events for select to authenticated
using (
  exists (
    select 1 from public.swing_videos sv
    where sv.id = video_audit_events.video_id
      and (
        sv.player_id = auth.uid()
        or exists (
          select 1 from public.coach_player_links cpl
          where cpl.coach_id = auth.uid()
            and cpl.player_id = sv.player_id
            and cpl.status = 'accepted'
        )
      )
  )
);

-- Audit writes are server-only through the service role.
revoke insert, update, delete on public.video_audit_events from authenticated, anon;

commit;
