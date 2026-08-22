-- Vector Golf Performance · Package 7H.3 selected-player pilot
create table if not exists public.pilot_enrolments(
 id uuid primary key default gen_random_uuid(), player_id uuid not null references public.profiles(id) on delete cascade,
 coach_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'invited' check(status in('invited','active','completed','withdrawn')),
 start_date date, target_end_date date, pilot_goal text not null default '', consent_confirmed_at timestamptz,
 coach_summary text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(player_id,coach_id));
create table if not exists public.pilot_feedback(
 id uuid primary key default gen_random_uuid(), enrolment_id uuid not null references public.pilot_enrolments(id) on delete cascade,
 respondent_id uuid not null references public.profiles(id) on delete cascade, respondent_role text not null check(respondent_role in('player','coach')),
 checkpoint text not null check(checkpoint in('onboarding','week_2','week_4','week_8','final','ad_hoc')),
 ease_score int check(ease_score between 1 and 5), confidence_score int check(confidence_score between 1 and 5), reliability_score int check(reliability_score between 1 and 5),
 what_worked text not null default '', what_was_unclear text not null default '', improvement_request text not null default '', follow_up_allowed boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(enrolment_id,respondent_id,checkpoint));
create table if not exists public.pilot_issues(
 id uuid primary key default gen_random_uuid(), enrolment_id uuid not null references public.pilot_enrolments(id) on delete cascade,
 reported_by uuid not null references public.profiles(id) on delete cascade, category text not null check(category in('usability','data','sync','content','access','other')),
 severity text not null default 'medium' check(severity in('low','medium','high','blocker')), summary text not null, detail text not null default '',
 status text not null default 'open' check(status in('open','in_review','resolved','wont_fix')), coach_notes text not null default '',
 created_at timestamptz not null default now(), resolved_at timestamptz, updated_at timestamptz not null default now());
create index if not exists pilot_enrolments_player_idx on public.pilot_enrolments(player_id,status);
create index if not exists pilot_feedback_enrolment_idx on public.pilot_feedback(enrolment_id,checkpoint);
create index if not exists pilot_issues_enrolment_idx on public.pilot_issues(enrolment_id,status,severity);

alter table public.pilot_enrolments enable row level security;alter table public.pilot_feedback enable row level security;alter table public.pilot_issues enable row level security;
drop policy if exists "pilot participants read enrolment" on public.pilot_enrolments;create policy "pilot participants read enrolment" on public.pilot_enrolments for select using(player_id=auth.uid() or coach_id=auth.uid());
drop policy if exists "coaches manage pilot enrolment" on public.pilot_enrolments;create policy "coaches manage pilot enrolment" on public.pilot_enrolments for all using(coach_id=auth.uid() and public.is_coach_of(player_id)) with check(coach_id=auth.uid() and public.is_coach_of(player_id));
drop policy if exists "participants read pilot feedback" on public.pilot_feedback;create policy "participants read pilot feedback" on public.pilot_feedback for select using(exists(select 1 from public.pilot_enrolments e where e.id=enrolment_id and (e.player_id=auth.uid() or e.coach_id=auth.uid())));
drop policy if exists "participants submit own feedback" on public.pilot_feedback;create policy "participants submit own feedback" on public.pilot_feedback for insert with check(respondent_id=auth.uid() and exists(select 1 from public.pilot_enrolments e where e.id=enrolment_id and (e.player_id=auth.uid() or e.coach_id=auth.uid())));
drop policy if exists "participants update own feedback" on public.pilot_feedback;create policy "participants update own feedback" on public.pilot_feedback for update using(respondent_id=auth.uid()) with check(respondent_id=auth.uid());
drop policy if exists "participants read pilot issues" on public.pilot_issues;create policy "participants read pilot issues" on public.pilot_issues for select using(exists(select 1 from public.pilot_enrolments e where e.id=enrolment_id and (e.player_id=auth.uid() or e.coach_id=auth.uid())));
drop policy if exists "participants report pilot issues" on public.pilot_issues;create policy "participants report pilot issues" on public.pilot_issues for insert with check(reported_by=auth.uid() and exists(select 1 from public.pilot_enrolments e where e.id=enrolment_id and (e.player_id=auth.uid() or e.coach_id=auth.uid())));
drop policy if exists "coaches update pilot issues" on public.pilot_issues;create policy "coaches update pilot issues" on public.pilot_issues for update using(exists(select 1 from public.pilot_enrolments e where e.id=enrolment_id and e.coach_id=auth.uid())) with check(exists(select 1 from public.pilot_enrolments e where e.id=enrolment_id and e.coach_id=auth.uid()));
grant select,insert,update on public.pilot_enrolments,public.pilot_feedback,public.pilot_issues to authenticated;

create or replace function public.pilot_readiness(target_enrolment uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.pilot_enrolments;result jsonb;begin select * into e from pilot_enrolments where id=target_enrolment;if e.id is null or not(e.player_id=auth.uid() or e.coach_id=auth.uid()) then raise exception 'Pilot enrolment is not available';end if;
select jsonb_build_object('feedback_count',(select count(*) from pilot_feedback where enrolment_id=e.id),'average_ease',(select round(avg(ease_score),1) from pilot_feedback where enrolment_id=e.id),'average_confidence',(select round(avg(confidence_score),1) from pilot_feedback where enrolment_id=e.id),'average_reliability',(select round(avg(reliability_score),1) from pilot_feedback where enrolment_id=e.id),'open_issues',(select count(*) from pilot_issues where enrolment_id=e.id and status in('open','in_review')),'blockers',(select count(*) from pilot_issues where enrolment_id=e.id and severity='blocker' and status in('open','in_review')),'resolved_issues',(select count(*) from pilot_issues where enrolment_id=e.id and status='resolved'),'ready_to_complete',((select count(*) from pilot_feedback where enrolment_id=e.id and respondent_role='player')>=2 and (select count(*) from pilot_issues where enrolment_id=e.id and severity='blocker' and status in('open','in_review'))=0)) into result;return result;end $$;
grant execute on function public.pilot_readiness(uuid) to authenticated;
