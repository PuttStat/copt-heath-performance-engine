-- Vector Golf Performance · Package 7E.3 coach-player workspace helpers
create or replace function public.link_player_by_email(target_email text) returns uuid language plpgsql security definer set search_path=public as $$
declare target_id uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in('coach','admin')) then raise exception 'Coach access required'; end if;
  select id into target_id from public.profiles where lower(email)=lower(trim(target_email)) and role='player';
  if target_id is null then raise exception 'No player account found for that email'; end if;
  insert into public.coach_player_links(coach_id,player_id) values(auth.uid(),target_id) on conflict do nothing;
  return target_id;
end; $$;
create or replace function public.unlink_player(target_player uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in('coach','admin')) then raise exception 'Coach access required'; end if;
  delete from public.coach_player_links where coach_id=auth.uid() and player_id=target_player;
end; $$;
revoke all on function public.link_player_by_email(text) from public;
revoke all on function public.unlink_player(uuid) from public;
grant execute on function public.link_player_by_email(text) to authenticated;
grant execute on function public.unlink_player(uuid) to authenticated;
