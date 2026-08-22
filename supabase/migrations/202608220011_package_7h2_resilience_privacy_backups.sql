-- Vector Golf Performance · Package 7H.2 resilience, privacy and logical backups
create table if not exists public.player_backup_snapshots(
 id uuid primary key default gen_random_uuid(),player_id uuid not null references profiles(id) on delete cascade,
 created_by uuid not null references profiles(id) on delete cascade,snapshot jsonb not null,checksum text not null,
 record_counts jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists player_backup_snapshots_player_idx on public.player_backup_snapshots(player_id,created_at desc);
create table if not exists public.client_error_reports(
 id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete set null,route text not null,
 message text not null,error_digest text,context jsonb not null default '{}'::jsonb,resolved boolean not null default false,created_at timestamptz not null default now()
);
create index if not exists client_error_reports_created_idx on public.client_error_reports(created_at desc);

create or replace function public.export_player_data(target_player uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 if auth.uid() is null or(target_player<>auth.uid() and not public.is_coach_of(target_player)) then raise exception 'Player export is unavailable';end if;
 select jsonb_build_object('schema_version','7H.2','exported_at',now(),'player',(select to_jsonb(p) from profiles p where p.id=target_player),
  'rounds',coalesce((select jsonb_agg(to_jsonb(r) order by r.played_at) from rounds r where r.player_id=target_player),'[]'::jsonb),
  'shot_band_results',coalesce((select jsonb_agg(to_jsonb(b)) from shot_band_results b where b.player_id=target_player),'[]'::jsonb),
  'detailed_shots',coalesce((select jsonb_agg(to_jsonb(d)) from detailed_shots d where d.player_id=target_player),'[]'::jsonb),
  'diagnostic_cases',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from diagnostic_cases d where d.player_id=target_player),'[]'::jsonb),
  'recommendations',coalesce((select jsonb_agg(to_jsonb(cr)) from case_recommendations cr join diagnostic_cases d on d.id=cr.case_id where d.player_id=target_player),'[]'::jsonb),
  'programme_intake',(select to_jsonb(i) from programme_intakes i where i.player_id=target_player),
  'programmes',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.created_at) from programmes pr where pr.player_id=target_player),'[]'::jsonb),
  'programme_weeks',coalesce((select jsonb_agg(to_jsonb(pw)) from programme_weeks pw join programmes pr on pr.id=pw.programme_id where pr.player_id=target_player),'[]'::jsonb),
  'programme_sessions',coalesce((select jsonb_agg(to_jsonb(ps)) from programme_sessions ps join programme_weeks pw on pw.id=ps.programme_week_id join programmes pr on pr.id=pw.programme_id where pr.player_id=target_player),'[]'::jsonb),
  'session_blocks',coalesce((select jsonb_agg(to_jsonb(sb)) from session_blocks sb join programme_sessions ps on ps.id=sb.session_id join programme_weeks pw on pw.id=ps.programme_week_id join programmes pr on pr.id=pw.programme_id where pr.player_id=target_player),'[]'::jsonb),
  'session_logs',coalesce((select jsonb_agg(to_jsonb(sl) order by sl.created_at) from session_logs sl where sl.player_id=target_player),'[]'::jsonb),
  'block_completions',coalesce((select jsonb_agg(to_jsonb(bc)) from block_completions bc join session_logs sl on sl.id=bc.session_log_id where sl.player_id=target_player),'[]'::jsonb),
  'session_reviews',coalesce((select jsonb_agg(to_jsonb(sr)) from session_reviews sr join session_logs sl on sl.id=sr.session_log_id where sl.player_id=target_player),'[]'::jsonb),
  'programme_retests',coalesce((select jsonb_agg(to_jsonb(rt)) from programme_retests rt where rt.player_id=target_player),'[]'::jsonb),
  'week_adjustments',coalesce((select jsonb_agg(to_jsonb(wa)) from week_adjustments wa where wa.player_id=target_player),'[]'::jsonb),
  'trackman_sessions',coalesce((select jsonb_agg(to_jsonb(ts) order by ts.created_at) from trackman_sessions ts where ts.player_id=target_player),'[]'::jsonb),
  'trackman_shots',coalesce((select jsonb_agg(to_jsonb(tsh)) from trackman_shots tsh where tsh.player_id=target_player),'[]'::jsonb)) into result;
 return result;end $$;

create or replace function public.create_player_backup(target_player uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare data jsonb;snapshot_id uuid;begin
 data:=public.export_player_data(target_player);
 insert into player_backup_snapshots(player_id,created_by,snapshot,checksum,record_counts) values(target_player,auth.uid(),data,md5(data::text),jsonb_build_object('rounds',jsonb_array_length(data->'rounds'),'diagnostics',jsonb_array_length(data->'diagnostic_cases'),'programmes',jsonb_array_length(data->'programmes'),'trackman_shots',jsonb_array_length(data->'trackman_shots'))) returning id into snapshot_id;
 delete from player_backup_snapshots where player_id=target_player and id in(select id from player_backup_snapshots where player_id=target_player order by created_at desc offset 5);
 return snapshot_id;end $$;

alter table player_backup_snapshots enable row level security;alter table client_error_reports enable row level security;
drop policy if exists "players and coaches read backups" on player_backup_snapshots;create policy "players and coaches read backups" on player_backup_snapshots for select using(player_id=auth.uid() or public.is_coach_of(player_id));
drop policy if exists "users create error reports" on client_error_reports;create policy "users create error reports" on client_error_reports for insert with check(user_id is null or user_id=auth.uid());
drop policy if exists "admins read error reports" on client_error_reports;create policy "admins read error reports" on client_error_reports for select using(public.is_library_editor());
grant select on player_backup_snapshots to authenticated;grant insert on client_error_reports to authenticated;grant select on client_error_reports to authenticated;
grant execute on function public.export_player_data(uuid) to authenticated;grant execute on function public.create_player_backup(uuid) to authenticated;
