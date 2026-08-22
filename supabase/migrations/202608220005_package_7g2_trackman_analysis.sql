-- Vector Golf Performance · Package 7G.2 TrackMan session analysis
alter table public.trackman_sessions add column if not exists test_type text not null default 'standard';
alter table public.trackman_sessions add column if not exists comparison_group text;
alter table public.trackman_sessions drop constraint if exists trackman_sessions_test_type_check;
alter table public.trackman_sessions add constraint trackman_sessions_test_type_check check(test_type in ('standard','baseline','no_aid','transfer','retest'));

create or replace function public.classify_trackman_session(target_session uuid,new_test_type text,new_comparison_group text)
returns void language plpgsql security definer set search_path=public as $$
declare target_player uuid;
begin
  if new_test_type not in ('standard','baseline','no_aid','transfer','retest') then raise exception 'Unsupported TrackMan test type'; end if;
  select player_id into target_player from public.trackman_sessions where id=target_session;
  if target_player is null or not public.is_coach_of(target_player) then raise exception 'Session is unavailable'; end if;
  update public.trackman_sessions set test_type=new_test_type,comparison_group=nullif(trim(new_comparison_group),'') where id=target_session;
end; $$;
grant execute on function public.classify_trackman_session(uuid,text,text) to authenticated;
