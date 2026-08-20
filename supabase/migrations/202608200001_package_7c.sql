-- Vector Golf Performance · Package 7C
-- Run once in Supabase SQL Editor. All player tables enforce Row Level Security.

create extension if not exists pgcrypto;
create type public.profile_role as enum ('player', 'coach', 'admin');
create type public.round_entry_mode as enum ('quick', 'detailed', 'trackman');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.profile_role not null default 'player',
  beta_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_player_links (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, player_id),
  constraint coach_not_player check (coach_id <> player_id)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  played_at timestamptz not null,
  course_name text not null default 'Not recorded',
  entry_mode public.round_entry_mode not null default 'quick',
  sync_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shot_band_results (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  shot_band text not null,
  opportunities integer,
  successes integer,
  miss_short integer,
  miss_long integer,
  miss_left integer,
  miss_right integer,
  created_at timestamptz not null default now(),
  unique (round_id, shot_band),
  constraint nonnegative_opportunities check (opportunities is null or opportunities >= 0),
  constraint nonnegative_successes check (successes is null or successes >= 0),
  constraint successes_within_opportunities check (successes is null or opportunities is null or successes <= opportunities)
);

create index rounds_player_played_idx on public.rounds(player_id, played_at desc);
create index shot_results_player_band_idx on public.shot_band_results(player_id, shot_band);
create index coach_links_player_idx on public.coach_player_links(player_id);

create or replace function public.is_coach_of(target_player uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.coach_player_links where coach_id = auth.uid() and player_id = target_player) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into public.profiles(id, email, display_name) values(new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''), '@', 1))); return new; end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.coach_player_links enable row level security;
alter table public.rounds enable row level security;
alter table public.shot_band_results enable row level security;

create policy "players read own profile" on public.profiles for select using (id = auth.uid() or public.is_coach_of(id));
create policy "players update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users read relevant coaching links" on public.coach_player_links for select using (coach_id = auth.uid() or player_id = auth.uid());
create policy "players and coaches read rounds" on public.rounds for select using (player_id = auth.uid() or public.is_coach_of(player_id));
create policy "players insert own rounds" on public.rounds for insert with check (player_id = auth.uid());
create policy "players update own rounds" on public.rounds for update using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy "players delete own rounds" on public.rounds for delete using (player_id = auth.uid());
create policy "players and coaches read results" on public.shot_band_results for select using (player_id = auth.uid() or public.is_coach_of(player_id));
create policy "players insert own results" on public.shot_band_results for insert with check (player_id = auth.uid() and exists(select 1 from public.rounds r where r.id = round_id and r.player_id = auth.uid()));
create policy "players update own results" on public.shot_band_results for update using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy "players delete own results" on public.shot_band_results for delete using (player_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.coach_player_links, public.rounds, public.shot_band_results to authenticated;
grant usage, select on all sequences in schema public to authenticated;
