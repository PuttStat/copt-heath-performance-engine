-- Vector Golf Performance · Package 7G.4 coach player overview
create or replace function public.coach_player_overview() returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(row_data order by (row_data->>'priority_score')::int desc,lower(row_data->>'display_name')),'[]'::jsonb) from(
 select jsonb_build_object('player_id',p.id,'display_name',coalesce(p.display_name,p.email),'email',p.email,
  'programme_status',coalesce((select pr.status from programmes pr where pr.player_id=p.id order by pr.created_at desc limit 1),'none'),
  'current_week',coalesce((select pr.current_week from programmes pr where pr.player_id=p.id order by pr.created_at desc limit 1),0),
  'adherence_percent',coalesce((select round(100.0*coalesce((select sum(sl.actual_minutes) from programme_sessions ps left join session_logs sl on sl.session_id=ps.id and sl.player_id=p.id where ps.programme_week_id=pw.id),0)/nullif((select sum(sb.minutes) from programme_sessions ps join session_blocks sb on sb.session_id=ps.id where ps.programme_week_id=pw.id),0),0) from programmes pr join programme_weeks pw on pw.programme_id=pr.id and pw.week_number=pr.current_week where pr.player_id=p.id and pr.status in('draft','published') order by pr.created_at desc limit 1),0),
  'safety_flags',(select count(*) from session_logs sl where sl.player_id=p.id and sl.safety_status in('monitor','stop_and_review') and sl.updated_at>=now()-interval '21 days'),
  'stop_flags',(select count(*) from session_logs sl where sl.player_id=p.id and sl.safety_status='stop_and_review' and sl.updated_at>=now()-interval '21 days'),
  'incomplete_sessions',(select count(*) from session_logs sl where sl.player_id=p.id and sl.completion_status in('not_started','partial','stopped') and sl.updated_at>=now()-interval '21 days'),
  'unreviewed_sessions',(select count(*) from session_logs sl where sl.player_id=p.id and sl.completed_at is not null and not exists(select 1 from session_reviews sr where sr.session_log_id=sl.id)),
  'outstanding_retests',(select count(*) from programme_retests r where r.player_id=p.id and r.status in('scheduled','submitted')),
  'overdue_retests',(select count(*) from programme_retests r where r.player_id=p.id and r.status='scheduled' and r.scheduled_for<current_date),
  'draft_diagnostics',(select count(*) from diagnostic_cases d where d.player_id=p.id and d.status='draft'),
  'last_round',(select max(r.played_at) from rounds r where r.player_id=p.id),'last_trackman',(select max(t.created_at) from trackman_sessions t where t.player_id=p.id),'last_session',(select max(sl.updated_at) from session_logs sl where sl.player_id=p.id),
  'priority_score',(select count(*)*8 from session_logs sl where sl.player_id=p.id and sl.safety_status='stop_and_review' and sl.updated_at>=now()-interval '21 days')+(select count(*)*4 from session_logs sl where sl.player_id=p.id and sl.safety_status='monitor' and sl.updated_at>=now()-interval '21 days')+(select count(*)*3 from programme_retests r where r.player_id=p.id and r.status='scheduled' and r.scheduled_for<current_date)+(select count(*)*2 from session_logs sl where sl.player_id=p.id and sl.completed_at is not null and not exists(select 1 from session_reviews sr where sr.session_log_id=sl.id))+(select count(*) from diagnostic_cases d where d.player_id=p.id and d.status='draft')) row_data
 from coach_player_links l join profiles p on p.id=l.player_id where l.coach_id=auth.uid()
) data $$;

create or replace function public.coach_player_history(target_player uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin if not public.is_coach_of(target_player) then raise exception 'Player is not linked to this coach';end if;
select coalesce(jsonb_agg(to_jsonb(history) order by occurred_at desc),'[]'::jsonb) into result from(
 select r.played_at occurred_at,'round' kind,r.course_name title,r.entry_mode::text status,'Round recorded' detail from rounds r where r.player_id=target_player
 union all select t.created_at,'trackman',t.title,t.test_type,coalesce(t.session_date::text,'TrackMan session imported') from trackman_sessions t where t.player_id=target_player
 union all select sl.updated_at,'practice',ps.title,sl.completion_status,concat(coalesce(sl.actual_minutes,0),' min · RPE ',coalesce(sl.session_rpe,0),' · ',sl.safety_status) from session_logs sl join programme_sessions ps on ps.id=sl.session_id where sl.player_id=target_player
 union all select r.created_at,'retest',r.title,r.status,concat(r.retest_type,' · ',coalesce(r.scheduled_for::text,'unscheduled')) from programme_retests r where r.player_id=target_player
 union all select d.updated_at,'diagnostic',d.shot_band,d.status,d.observation from diagnostic_cases d where d.player_id=target_player
 union all select pr.updated_at,'programme',pr.title,pr.status,concat('Week ',pr.current_week,' · ',pr.primary_goal) from programmes pr where pr.player_id=target_player
 order by occurred_at desc limit 100) history;return result;end $$;
grant execute on function public.coach_player_overview() to authenticated;
grant execute on function public.coach_player_history(uuid) to authenticated;
