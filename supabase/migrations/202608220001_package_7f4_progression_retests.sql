-- Vector Golf Performance · Package 7F.4 weekly progression, retests and audit trail
create table if not exists public.programme_retests (
  id uuid primary key default gen_random_uuid(),
  programme_week_id uuid not null references public.programme_weeks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  retest_type text not null check (retest_type in ('baseline','no_aid','transfer','outcome')),
  title text not null,
  protocol text not null,
  success_criterion text,
  baseline_value numeric,
  result_value numeric,
  unit text,
  transfer_passed boolean,
  player_note text,
  coach_note text,
  status text not null default 'scheduled' check (status in ('scheduled','submitted','reviewed','cancelled')),
  scheduled_for date,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.week_adjustments (
  id uuid primary key default gen_random_uuid(),
  programme_week_id uuid not null references public.programme_weeks(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('keep','progress','modify','stop')),
  rationale text not null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  next_week_focus text,
  recommended_golf_minutes integer check (recommended_golf_minutes >= 0),
  recommended_vector_minutes integer check (recommended_vector_minutes >= 0),
  status text not null default 'draft' check (status in ('draft','published','superseded')),
  published_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.week_adjustment_versions (
  id bigint generated always as identity primary key,
  week_adjustment_id uuid not null references public.week_adjustments(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists programme_retests_week_idx on public.programme_retests(programme_week_id, created_at);
create index if not exists week_adjustments_week_idx on public.week_adjustments(programme_week_id, created_at desc);

create or replace function public.capture_week_adjustment_version()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old is distinct from new then
    insert into public.week_adjustment_versions(week_adjustment_id,snapshot,changed_by)
    values(old.id,to_jsonb(old),auth.uid());
    new.updated_at=now();
  end if;
  return new;
end;
$$;

create or replace function public.submit_programme_retest(
  target_retest uuid,
  submitted_result numeric,
  submitted_unit text,
  submitted_transfer_passed boolean,
  submitted_player_note text
) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.programme_retests
  set result_value=submitted_result,
      unit=nullif(submitted_unit,''),
      transfer_passed=submitted_transfer_passed,
      player_note=nullif(submitted_player_note,''),
      status='submitted',
      completed_at=now(),
      updated_at=now()
  where id=target_retest and player_id=auth.uid() and status='scheduled';
  if not found then raise exception 'Retest is unavailable or has already been submitted'; end if;
end;
$$;

drop trigger if exists week_adjustment_version_trigger on public.week_adjustments;
create trigger week_adjustment_version_trigger before update on public.week_adjustments
for each row execute procedure public.capture_week_adjustment_version();

alter table public.programme_retests enable row level security;
alter table public.week_adjustments enable row level security;
alter table public.week_adjustment_versions enable row level security;

drop policy if exists "players read own retests" on public.programme_retests;
drop policy if exists "coaches manage linked retests" on public.programme_retests;
drop policy if exists "players read published adjustments" on public.week_adjustments;
drop policy if exists "coaches manage linked adjustments" on public.week_adjustments;
drop policy if exists "coaches read linked adjustment history" on public.week_adjustment_versions;

create policy "players read own retests" on public.programme_retests for select using(player_id=auth.uid());
create policy "coaches manage linked retests" on public.programme_retests for all
using(created_by=auth.uid() and public.is_coach_of(player_id))
with check(created_by=auth.uid() and public.is_coach_of(player_id));

create policy "players read published adjustments" on public.week_adjustments for select
using(player_id=auth.uid() and status='published');
create policy "coaches manage linked adjustments" on public.week_adjustments for all
using(coach_id=auth.uid() and public.is_coach_of(player_id))
with check(coach_id=auth.uid() and public.is_coach_of(player_id));
create policy "coaches read linked adjustment history" on public.week_adjustment_versions for select
using(exists(select 1 from public.week_adjustments a where a.id=week_adjustment_id and a.coach_id=auth.uid() and public.is_coach_of(a.player_id)));

grant select,insert,update,delete on public.programme_retests,public.week_adjustments to authenticated;
grant select on public.week_adjustment_versions to authenticated;
grant execute on function public.submit_programme_retest(uuid,numeric,text,boolean,text) to authenticated;
grant usage,select on all sequences in schema public to authenticated;
