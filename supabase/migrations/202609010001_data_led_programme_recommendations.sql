-- Vector Golf Performance · data-led programme recommendations
-- Adds explainable recommendations and a guarded self-directed planning route.

alter table public.programmes
  add column if not exists planning_mode text not null default 'coach_led'
    check (planning_mode in ('coach_led','self_directed')),
  add column if not exists recommendation_generated_at timestamptz,
  add column if not exists recommendation_snapshot jsonb not null default '{}'::jsonb;

alter table public.session_blocks
  add column if not exists recommendation_source text
    check (recommendation_source is null or recommendation_source in ('vector_engine','coach_approved','coach_override','player_override')),
  add column if not exists recommendation_rationale text,
  add column if not exists recommendation_score numeric,
  add column if not exists evidence_snapshot jsonb;

create or replace function public.player_has_linked_coach(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.coach_player_links
    where player_id=target_player
  )
$$;

drop policy if exists "players manage self directed programmes" on public.programmes;
create policy "players manage self directed programmes"
on public.programmes for all
using (
  player_id=auth.uid()
  and coach_id=auth.uid()
  and planning_mode='self_directed'
  and not public.player_has_linked_coach(player_id)
)
with check (
  player_id=auth.uid()
  and coach_id=auth.uid()
  and planning_mode='self_directed'
  and not public.player_has_linked_coach(player_id)
);

drop policy if exists "players manage self directed weeks" on public.programme_weeks;
create policy "players manage self directed weeks"
on public.programme_weeks for all
using (
  exists(
    select 1 from public.programmes p
    where p.id=programme_id
      and p.player_id=auth.uid()
      and p.coach_id=auth.uid()
      and p.planning_mode='self_directed'
      and not public.player_has_linked_coach(p.player_id)
  )
)
with check (
  exists(
    select 1 from public.programmes p
    where p.id=programme_id
      and p.player_id=auth.uid()
      and p.coach_id=auth.uid()
      and p.planning_mode='self_directed'
      and not public.player_has_linked_coach(p.player_id)
  )
);

drop policy if exists "players manage self directed sessions" on public.programme_sessions;
create policy "players manage self directed sessions"
on public.programme_sessions for all
using (
  exists(
    select 1
    from public.programme_weeks w
    join public.programmes p on p.id=w.programme_id
    where w.id=programme_week_id
      and p.player_id=auth.uid()
      and p.coach_id=auth.uid()
      and p.planning_mode='self_directed'
      and not public.player_has_linked_coach(p.player_id)
  )
)
with check (
  exists(
    select 1
    from public.programme_weeks w
    join public.programmes p on p.id=w.programme_id
    where w.id=programme_week_id
      and p.player_id=auth.uid()
      and p.coach_id=auth.uid()
      and p.planning_mode='self_directed'
      and not public.player_has_linked_coach(p.player_id)
  )
);

drop policy if exists "players manage self directed blocks" on public.session_blocks;
create policy "players manage self directed blocks"
on public.session_blocks for all
using (
  exists(
    select 1
    from public.programme_sessions s
    join public.programme_weeks w on w.id=s.programme_week_id
    join public.programmes p on p.id=w.programme_id
    where s.id=session_id
      and p.player_id=auth.uid()
      and p.coach_id=auth.uid()
      and p.planning_mode='self_directed'
      and not public.player_has_linked_coach(p.player_id)
  )
)
with check (
  exists(
    select 1
    from public.programme_sessions s
    join public.programme_weeks w on w.id=s.programme_week_id
    join public.programmes p on p.id=w.programme_id
    where s.id=session_id
      and p.player_id=auth.uid()
      and p.coach_id=auth.uid()
      and p.planning_mode='self_directed'
      and not public.player_has_linked_coach(p.player_id)
  )
);

grant execute on function public.player_has_linked_coach(uuid) to authenticated;
