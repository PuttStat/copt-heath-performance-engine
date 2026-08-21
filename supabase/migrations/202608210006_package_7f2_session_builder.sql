-- Vector Golf Performance · Package 7F.2 session builder and reconciliation
create table if not exists public.programme_sessions (
  id uuid primary key default gen_random_uuid(),
  programme_week_id uuid not null references public.programme_weeks(id) on delete cascade,
  session_number integer not null check(session_number>0),
  title text not null,
  scheduled_day text,
  objective text,
  status text not null default 'draft' check(status in('draft','published','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(programme_week_id,session_number)
);
create table if not exists public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.programme_sessions(id) on delete cascade,
  sequence integer not null check(sequence>0),
  domain text not null check(domain in('golf','vector')),
  stage text not null check(stage in('baseline','technique','skill','random','pressure','transfer','vector')),
  library_item_id uuid references public.library_items(id) on delete restrict,
  source_case_id uuid references public.diagnostic_cases(id) on delete set null,
  minutes integer not null check(minutes>0 and minutes<=300),
  instructions text,
  success_criterion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,sequence)
);
create table if not exists public.session_block_versions (
  id bigint generated always as identity primary key,
  session_block_id uuid not null references public.session_blocks(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists programme_sessions_week_idx on public.programme_sessions(programme_week_id,session_number);
create index if not exists session_blocks_session_idx on public.session_blocks(session_id,sequence);
create or replace function public.capture_session_block_version() returns trigger language plpgsql security definer set search_path=public as $$ begin if old is distinct from new then insert into public.session_block_versions(session_block_id,snapshot,changed_by) values(old.id,to_jsonb(old),auth.uid()); new.updated_at=now(); end if; return new; end; $$;
drop trigger if exists session_block_version_trigger on public.session_blocks;
create trigger session_block_version_trigger before update on public.session_blocks for each row execute procedure public.capture_session_block_version();
create or replace function public.week_session_totals(target_week uuid) returns table(golf_minutes bigint,vector_minutes bigint,unassigned_blocks bigint) language sql stable security definer set search_path=public as $$ select coalesce(sum(b.minutes) filter(where b.domain='golf'),0),coalesce(sum(b.minutes) filter(where b.domain='vector'),0),count(*) filter(where b.id is not null and b.library_item_id is null) from public.programme_sessions s left join public.session_blocks b on b.session_id=s.id where s.programme_week_id=target_week $$;
create or replace function public.validate_week_release() returns trigger language plpgsql security definer set search_path=public as $$ declare actual_golf bigint;actual_vector bigint;missing bigint;begin if new.status='published' and old.status is distinct from new.status then select golf_minutes,vector_minutes,unassigned_blocks into actual_golf,actual_vector,missing from public.week_session_totals(new.id);if actual_golf<>new.golf_minutes or actual_vector<>new.vector_minutes then raise exception 'Session minutes must exactly match the weekly golf and Vector allocation';end if;if missing>0 then raise exception 'Every session block needs an approved library item before release';end if;end if;return new;end;$$;
drop trigger if exists programme_week_release_trigger on public.programme_weeks;
create trigger programme_week_release_trigger before update of status on public.programme_weeks for each row execute procedure public.validate_week_release();
create or replace function public.validate_programme_release() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.status='published' and old.status is distinct from new.status and not exists(select 1 from public.programme_weeks where programme_id=new.id and status='published') then raise exception 'Release at least one reconciled session week before publishing the programme';end if;return new;end;$$;
drop trigger if exists programme_release_trigger on public.programmes;
create trigger programme_release_trigger before update of status on public.programmes for each row execute procedure public.validate_programme_release();
alter table public.programme_sessions enable row level security;alter table public.session_blocks enable row level security;alter table public.session_block_versions enable row level security;
create policy "players read released sessions" on public.programme_sessions for select using(exists(select 1 from public.programme_weeks w join public.programmes p on p.id=w.programme_id where w.id=programme_week_id and p.player_id=auth.uid() and p.status in('published','completed') and w.status in('published','completed')));
create policy "coaches manage linked sessions" on public.programme_sessions for all using(exists(select 1 from public.programme_weeks w join public.programmes p on p.id=w.programme_id where w.id=programme_week_id and p.coach_id=auth.uid() and public.is_coach_of(p.player_id))) with check(exists(select 1 from public.programme_weeks w join public.programmes p on p.id=w.programme_id where w.id=programme_week_id and p.coach_id=auth.uid() and public.is_coach_of(p.player_id)));
create policy "players read released blocks" on public.session_blocks for select using(exists(select 1 from public.programme_sessions s join public.programme_weeks w on w.id=s.programme_week_id join public.programmes p on p.id=w.programme_id where s.id=session_id and p.player_id=auth.uid() and p.status in('published','completed') and w.status in('published','completed')));
create policy "coaches manage linked blocks" on public.session_blocks for all using(exists(select 1 from public.programme_sessions s join public.programme_weeks w on w.id=s.programme_week_id join public.programmes p on p.id=w.programme_id where s.id=session_id and p.coach_id=auth.uid() and public.is_coach_of(p.player_id))) with check(exists(select 1 from public.programme_sessions s join public.programme_weeks w on w.id=s.programme_week_id join public.programmes p on p.id=w.programme_id where s.id=session_id and p.coach_id=auth.uid() and public.is_coach_of(p.player_id)));
create policy "coaches read block history" on public.session_block_versions for select using(public.is_library_editor());
grant select,insert,update,delete on public.programme_sessions,public.session_blocks to authenticated;grant select on public.session_block_versions to authenticated;grant execute on function public.week_session_totals(uuid) to authenticated;grant usage,select on all sequences in schema public to authenticated;
