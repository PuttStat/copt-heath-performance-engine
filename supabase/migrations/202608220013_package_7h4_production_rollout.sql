-- Vector Golf Performance · Package 7H.4 production release and wider rollout
create table if not exists public.release_records(
 id uuid primary key default gen_random_uuid(), version_label text not null unique, release_name text not null,
 status text not null default 'candidate' check(status in('candidate','approved','rolling_out','paused','completed','rolled_back')),
 created_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id), approved_at timestamptz,
 release_notes text not null default '', rollback_plan text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.release_check_items(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.release_records(id) on delete cascade,
 check_key text not null, label text not null, category text not null check(category in('pilot','data','security','accessibility','recovery','operations')),
 required boolean not null default true, status text not null default 'pending' check(status in('pending','passed','failed','not_applicable')),
 evidence_note text not null default '', checked_by uuid references public.profiles(id), checked_at timestamptz, unique(release_id,check_key));
create table if not exists public.rollout_cohorts(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.release_records(id) on delete cascade,
 cohort_name text not null, sequence_number int not null check(sequence_number>0), planned_players int not null default 0 check(planned_players>=0),
 status text not null default 'planned' check(status in('planned','active','paused','completed','cancelled')),
 start_after date, started_at timestamptz, completed_at timestamptz, success_note text not null default '', unique(release_id,sequence_number));
create table if not exists public.release_incidents(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.release_records(id) on delete cascade,
 cohort_id uuid references public.rollout_cohorts(id) on delete set null, reported_by uuid not null references public.profiles(id),
 severity text not null check(severity in('low','medium','high','critical')), summary text not null, detail text not null default '',
 status text not null default 'open' check(status in('open','monitoring','resolved')), rollback_required boolean not null default false,
 created_at timestamptz not null default now(), resolved_at timestamptz, updated_at timestamptz not null default now());
create index if not exists release_check_items_release_idx on public.release_check_items(release_id,status);
create index if not exists rollout_cohorts_release_idx on public.rollout_cohorts(release_id,sequence_number);
create index if not exists release_incidents_release_idx on public.release_incidents(release_id,status,severity);
alter table public.release_records enable row level security;alter table public.release_check_items enable row level security;alter table public.rollout_cohorts enable row level security;alter table public.release_incidents enable row level security;
drop policy if exists "editors manage releases" on public.release_records;create policy "editors manage releases" on public.release_records for all using(public.is_library_editor()) with check(public.is_library_editor());
drop policy if exists "editors manage release checks" on public.release_check_items;create policy "editors manage release checks" on public.release_check_items for all using(public.is_library_editor()) with check(public.is_library_editor());
drop policy if exists "editors manage rollout cohorts" on public.rollout_cohorts;create policy "editors manage rollout cohorts" on public.rollout_cohorts for all using(public.is_library_editor()) with check(public.is_library_editor());
drop policy if exists "editors manage release incidents" on public.release_incidents;create policy "editors manage release incidents" on public.release_incidents for all using(public.is_library_editor()) with check(public.is_library_editor());
grant select,insert,update on public.release_records,public.release_check_items,public.rollout_cohorts,public.release_incidents to authenticated;

create or replace function public.create_release_candidate(candidate_version text,candidate_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;begin if not public.is_library_editor() then raise exception 'Coach or administrator access required';end if;
insert into release_records(version_label,release_name,created_by,release_notes,rollback_plan) values(candidate_version,candidate_name,auth.uid(),'Release candidate created for controlled validation.','Pause the active cohort, preserve records, restore the previous application release and verify database compatibility before resuming.') returning id into rid;
insert into release_check_items(release_id,check_key,label,category) values
(rid,'pilot_complete','Selected-player pilot completed','pilot'),(rid,'pilot_blockers','No unresolved pilot blockers','pilot'),
(rid,'data_integrity','Core data and TrackMan import verified','data'),(rid,'privacy_rls','Player and coach privacy policies verified','security'),
(rid,'keyboard_zoom','Keyboard, focus and 200% zoom checked','accessibility'),(rid,'backup_export','Player export and recovery snapshot checked','recovery'),
(rid,'offline_sync','Offline queue and retry behaviour checked','operations'),(rid,'error_recovery','Error recovery and incident route checked','operations');
return rid;end $$;
create or replace function public.release_readiness(target_release uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin if not public.is_library_editor() then raise exception 'Coach or administrator access required';end if;
select jsonb_build_object(
 'required_total',(select count(*) from release_check_items where release_id=target_release and required),
 'required_passed',(select count(*) from release_check_items where release_id=target_release and required and status in('passed','not_applicable')),
 'failed_checks',(select count(*) from release_check_items where release_id=target_release and status='failed'),
 'completed_pilots',(select count(*) from pilot_enrolments where status='completed'),
 'pilot_blockers',(select count(*) from pilot_issues where severity='blocker' and status in('open','in_review')),
 'open_critical_incidents',(select count(*) from release_incidents where release_id=target_release and severity='critical' and status<>'resolved'),
 'recent_backups',(select count(*) from player_backup_snapshots where created_at>=now()-interval '30 days'),
 'ready_to_approve',((select count(*) from release_check_items where release_id=target_release and required and status not in('passed','not_applicable'))=0 and (select count(*) from pilot_enrolments where status='completed')>0 and (select count(*) from pilot_issues where severity='blocker' and status in('open','in_review'))=0 and (select count(*) from release_incidents where release_id=target_release and severity='critical' and status<>'resolved')=0)) into result;return result;end $$;
create or replace function public.approve_release(target_release uuid) returns void language plpgsql security definer set search_path=public as $$
declare ready boolean;begin if not public.is_library_editor() then raise exception 'Coach or administrator access required';end if;select (release_readiness(target_release)->>'ready_to_approve')::boolean into ready;if not ready then raise exception 'Release gates are not complete';end if;update release_records set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=target_release;end $$;
grant execute on function public.create_release_candidate(text,text),public.release_readiness(uuid),public.approve_release(uuid) to authenticated;
