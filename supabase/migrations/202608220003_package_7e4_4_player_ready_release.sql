-- Vector Golf Performance · Package 7E.4.4 player-ready session integration
-- A programme week cannot be released unless every block uses an approved,
-- instruction-complete library item.
create or replace function public.enforce_player_ready_week_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1
      from public.programme_sessions session
      join public.session_blocks block on block.session_id = session.id
      where session.programme_week_id = new.id
    ) then
      raise exception 'A week must contain at least one session block before release.';
    end if;

    if exists (
      select 1
      from public.programme_sessions session
      join public.session_blocks block on block.session_id = session.id
      left join public.library_items item on item.id = block.library_item_id
      where session.programme_week_id = new.id
        and (
          item.id is null or
          item.status <> 'approved' or
          item.instruction_complete is not true
        )
    ) then
      raise exception 'Every session block must use an approved, player-ready library item before release.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_player_ready_week_release on public.programme_weeks;
create trigger enforce_player_ready_week_release
before update of status on public.programme_weeks
for each row
execute function public.enforce_player_ready_week_release();

revoke all on function public.enforce_player_ready_week_release() from public;
grant execute on function public.enforce_player_ready_week_release() to authenticated;
