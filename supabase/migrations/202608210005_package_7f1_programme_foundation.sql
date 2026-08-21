-- Vector Golf Performance · Package 7F.1 programme foundation
create table if not exists public.programme_intakes (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  primary_goal text not null default '',
  outcome_target text,
  weekly_golf_minutes integer not null default 180 check(weekly_golf_minutes between 0 and 1200),
  weekly_vector_minutes integer not null default 60 check(weekly_vector_minutes between 0 and 600),
  sessions_per_week integer not null default 3 check(sessions_per_week between 1 and 14),
  available_days text[] not null default '{}',
  facilities text[] not null default '{}',
  competition_dates text,
  recovery_constraints text,
  consent_confirmed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '12-Week Performance Programme',
  primary_goal text not null,
  start_date date not null,
  status text not null default 'draft' check(status in('draft','published','completed','archived')),
  golf_minutes_per_week integer not null default 180,
  vector_minutes_per_week integer not null default 60,
  current_week integer not null default 1 check(current_week between 1 and 12),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists programmes_one_active_player_idx on public.programmes(player_id) where status in('draft','published');
create table if not exists public.programme_weeks (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  week_number integer not null check(week_number between 1 and 12),
  phase text not null check(phase in('Measure','Build','Stabilise','Transfer','Perform')),
  focus text not null,
  golf_minutes integer not null default 180 check(golf_minutes>=0),
  vector_minutes integer not null default 60 check(vector_minutes>=0),
  review_type text,
  coach_notes text,
  status text not null default 'draft' check(status in('draft','published','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(programme_id,week_number)
);
create index if not exists programme_weeks_programme_idx on public.programme_weeks(programme_id,week_number);
alter table public.programme_intakes enable row level security;
alter table public.programmes enable row level security;
alter table public.programme_weeks enable row level security;
drop policy if exists "players manage own intake" on public.programme_intakes;
drop policy if exists "coaches read linked intake" on public.programme_intakes;
create policy "players manage own intake" on public.programme_intakes for all using(player_id=auth.uid()) with check(player_id=auth.uid());
create policy "coaches read linked intake" on public.programme_intakes for select using(public.is_coach_of(player_id));
drop policy if exists "players read published programmes" on public.programmes;
drop policy if exists "coaches manage linked programmes" on public.programmes;
create policy "players read published programmes" on public.programmes for select using(player_id=auth.uid() and status in('published','completed'));
create policy "coaches manage linked programmes" on public.programmes for all using(coach_id=auth.uid() and public.is_coach_of(player_id)) with check(coach_id=auth.uid() and public.is_coach_of(player_id));
drop policy if exists "players read published weeks" on public.programme_weeks;
drop policy if exists "coaches manage programme weeks" on public.programme_weeks;
create policy "players read published weeks" on public.programme_weeks for select using(exists(select 1 from public.programmes p where p.id=programme_id and p.player_id=auth.uid() and p.status in('published','completed')));
create policy "coaches manage programme weeks" on public.programme_weeks for all using(exists(select 1 from public.programmes p where p.id=programme_id and p.coach_id=auth.uid() and public.is_coach_of(p.player_id))) with check(exists(select 1 from public.programmes p where p.id=programme_id and p.coach_id=auth.uid() and public.is_coach_of(p.player_id)));
grant select,insert,update,delete on public.programme_intakes,public.programmes,public.programme_weeks to authenticated;
