-- Vector Golf Performance · Package 7D incremental migration
create table if not exists public.detailed_shots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  shot_sequence integer not null check (shot_sequence > 0),
  shot_band text not null,
  success boolean not null,
  miss_length text check (miss_length is null or miss_length in ('short','long')),
  miss_direction text check (miss_direction is null or miss_direction in ('left','right')),
  created_at timestamptz not null default now(),
  unique (round_id, hole_number, shot_sequence)
);
create index if not exists detailed_shots_player_band_idx on public.detailed_shots(player_id, shot_band);
create index if not exists detailed_shots_round_hole_idx on public.detailed_shots(round_id, hole_number, shot_sequence);
alter table public.detailed_shots enable row level security;
drop policy if exists "players and coaches read detailed shots" on public.detailed_shots;
drop policy if exists "players insert own detailed shots" on public.detailed_shots;
drop policy if exists "players update own detailed shots" on public.detailed_shots;
drop policy if exists "players delete own detailed shots" on public.detailed_shots;
create policy "players and coaches read detailed shots" on public.detailed_shots for select using (player_id = auth.uid() or public.is_coach_of(player_id));
create policy "players insert own detailed shots" on public.detailed_shots for insert with check (player_id = auth.uid() and exists(select 1 from public.rounds r where r.id = round_id and r.player_id = auth.uid()));
create policy "players update own detailed shots" on public.detailed_shots for update using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy "players delete own detailed shots" on public.detailed_shots for delete using (player_id = auth.uid());
grant select, insert, update, delete on public.detailed_shots to authenticated;
