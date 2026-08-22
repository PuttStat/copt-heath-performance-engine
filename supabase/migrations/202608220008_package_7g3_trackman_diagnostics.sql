-- Vector Golf Performance · Package 7G.3 TrackMan diagnostic workspace
alter table public.diagnostic_cases add column if not exists source_type text not null default 'performance';
alter table public.diagnostic_cases add column if not exists trackman_session_id uuid references public.trackman_sessions(id) on delete set null;
alter table public.diagnostic_cases add column if not exists evidence_snapshot jsonb;
alter table public.diagnostic_cases add column if not exists trackman_club text;
alter table public.diagnostic_cases add column if not exists impact_family text;
alter table public.diagnostic_cases add column if not exists supported_cause_test text;
alter table public.diagnostic_cases add column if not exists coach_diagnosis text;
alter table public.diagnostic_cases add column if not exists player_explanation text;
alter table public.diagnostic_cases drop constraint if exists diagnostic_cases_source_type_check;
alter table public.diagnostic_cases add constraint diagnostic_cases_source_type_check check(source_type in ('performance','trackman'));
alter table public.diagnostic_cases drop constraint if exists diagnostic_cases_impact_family_check;
alter table public.diagnostic_cases add constraint diagnostic_cases_impact_family_check check(impact_family is null or impact_family in ('centred','heel','toe','high','low','variable','not_available'));

create table if not exists public.diagnostic_case_versions(
 id bigint generated always as identity primary key,
 case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
 snapshot jsonb not null,changed_by uuid references public.profiles(id) on delete set null,
 changed_at timestamptz not null default now()
);
create index if not exists diagnostic_case_versions_case_idx on public.diagnostic_case_versions(case_id,changed_at desc);
create table if not exists public.case_recommendation_versions(
 id bigint generated always as identity primary key,case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
 recommendation_id uuid,action text not null check(action in ('insert','update','delete')),snapshot jsonb not null,
 changed_by uuid references public.profiles(id) on delete set null,changed_at timestamptz not null default now()
);
create index if not exists case_recommendation_versions_case_idx on public.case_recommendation_versions(case_id,changed_at desc);
create or replace function public.capture_diagnostic_case_version() returns trigger language plpgsql security definer set search_path=public as $$
begin if old is distinct from new then insert into public.diagnostic_case_versions(case_id,snapshot,changed_by) values(old.id,to_jsonb(old),auth.uid());new.updated_at=now();end if;return new;end $$;
drop trigger if exists diagnostic_case_version_trigger on public.diagnostic_cases;
create trigger diagnostic_case_version_trigger before update on public.diagnostic_cases for each row execute procedure public.capture_diagnostic_case_version();
create or replace function public.capture_case_recommendation_version() returns trigger language plpgsql security definer set search_path=public as $$
begin if tg_op='DELETE' then insert into public.case_recommendation_versions(case_id,recommendation_id,action,snapshot,changed_by) values(old.case_id,old.id,'delete',to_jsonb(old),auth.uid());return old;else insert into public.case_recommendation_versions(case_id,recommendation_id,action,snapshot,changed_by) values(new.case_id,new.id,lower(tg_op),to_jsonb(new),auth.uid());return new;end if;end $$;
drop trigger if exists case_recommendation_version_trigger on public.case_recommendations;
create trigger case_recommendation_version_trigger after insert or update or delete on public.case_recommendations for each row execute procedure public.capture_case_recommendation_version();

create or replace function public.review_trackman_case(target_case uuid,new_status text) returns void language plpgsql security definer set search_path=public as $$
declare target public.diagnostic_cases; item_count integer;
begin
 select * into target from public.diagnostic_cases where id=target_case and source_type='trackman';
 if target.id is null or not public.is_coach_of(target.player_id) then raise exception 'TrackMan review is unavailable'; end if;
 if new_status not in ('approved','rejected','superseded') then raise exception 'Unsupported review decision'; end if;
 if new_status='approved' then
   if nullif(trim(target.supported_cause_test),'') is null then raise exception 'Record the comparison test supporting the diagnosis'; end if;
   if nullif(trim(target.coach_diagnosis),'') is null then raise exception 'Record the coach diagnosis'; end if;
   if nullif(trim(target.player_explanation),'') is null then raise exception 'Add the player-facing explanation'; end if;
   select count(*) into item_count from public.case_recommendations where case_id=target_case;
   if item_count=0 then raise exception 'Assign at least one drill, test or Vector exercise'; end if;
 end if;
 update public.diagnostic_cases set status=new_status,coach_note=case when new_status='approved' then player_explanation else coach_note end,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=target_case;
end $$;

alter table public.diagnostic_case_versions enable row level security;
alter table public.case_recommendation_versions enable row level security;
drop policy if exists "coaches read linked diagnostic history" on public.diagnostic_case_versions;
create policy "coaches read linked diagnostic history" on public.diagnostic_case_versions for select using(exists(select 1 from public.diagnostic_cases c where c.id=case_id and public.is_library_editor() and(c.player_id=auth.uid() or public.is_coach_of(c.player_id))));
drop policy if exists "coaches read linked prescription history" on public.case_recommendation_versions;
create policy "coaches read linked prescription history" on public.case_recommendation_versions for select using(exists(select 1 from public.diagnostic_cases c where c.id=case_id and public.is_library_editor() and(c.player_id=auth.uid() or public.is_coach_of(c.player_id))));
grant select on public.diagnostic_case_versions,public.case_recommendation_versions to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.review_trackman_case(uuid,text) to authenticated;
