-- Vector Golf Performance · Package 7G.1 TrackMan import foundation
create table if not exists public.trackman_imports (
  id uuid primary key default gen_random_uuid(), coach_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade, file_name text not null, file_sha256 text not null,
  header_row integer not null, original_headers jsonb not null default '[]'::jsonb, import_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check(status in ('staged','completed','duplicate','failed')),
  accepted_rows integer not null default 0, rejected_rows integer not null default 0, created_at timestamptz not null default now(),
  unique(coach_id,file_sha256)
);
create table if not exists public.trackman_sessions (
  id uuid primary key default gen_random_uuid(), import_id uuid not null unique references public.trackman_imports(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade, coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, session_date date, location text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.trackman_shots (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.trackman_sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade, source_row integer not null, fingerprint text not null,
  club text, shot_date text, shot_time text, ball_speed numeric, club_speed numeric, smash_factor numeric, carry numeric, total numeric, roll numeric,
  launch_angle numeric, launch_direction numeric, spin_rate numeric, spin_axis numeric, height numeric, landing_angle numeric, hang_time numeric,
  curve numeric, side_distance numeric, face_angle numeric, club_path numeric, face_to_path numeric, attack_angle numeric, dynamic_loft numeric,
  spin_loft numeric, low_point numeric, swing_plane numeric, swing_direction numeric, swing_radius numeric, impact_height numeric, impact_offset numeric,
  d_plane numeric, trajectory text, target_distance numeric, temperature numeric, humidity numeric, air_pressure numeric, wind_speed numeric, wind_direction numeric,
  raw_values jsonb not null, created_at timestamptz not null default now(), unique(player_id,fingerprint)
);
create index if not exists trackman_sessions_player_idx on public.trackman_sessions(player_id,session_date desc);
create index if not exists trackman_shots_session_idx on public.trackman_shots(session_id,source_row);

create or replace function public.import_trackman_csv(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_import uuid; v_session uuid; v_shot jsonb; v_values jsonb; v_inserted integer:=0; v_duplicates integer:=0;
  v_player uuid:=(payload->>'player_id')::uuid; v_hash text:=payload->>'file_sha256';
begin
  if not public.is_coach_of(v_player) then raise exception 'You are not linked to this player'; end if;
  if coalesce(jsonb_array_length(payload->'shots'),0)=0 then raise exception 'No valid TrackMan shots were supplied'; end if;
  select id into v_import from public.trackman_imports where coach_id=auth.uid() and file_sha256=v_hash;
  if v_import is not null then return jsonb_build_object('status','duplicate','import_id',v_import,'inserted',0,'duplicates',jsonb_array_length(payload->'shots')); end if;
  insert into public.trackman_imports(coach_id,player_id,file_name,file_sha256,header_row,original_headers,import_metadata,rejected_rows)
  values(auth.uid(),v_player,payload->>'file_name',v_hash,(payload->>'header_row')::integer,payload->'headers',coalesce(payload->'metadata','{}'::jsonb),coalesce((payload->>'rejected_rows')::integer,0)) returning id into v_import;
  insert into public.trackman_sessions(import_id,player_id,coach_id,title,session_date,location,notes)
  values(v_import,v_player,auth.uid(),coalesce(nullif(payload->>'title',''),payload->>'file_name'),nullif(payload->>'session_date','')::date,nullif(payload->>'location',''),nullif(payload->>'notes','')) returning id into v_session;
  for v_shot in select value from jsonb_array_elements(payload->'shots') loop
    v_values:=v_shot->'values';
    insert into public.trackman_shots(session_id,player_id,source_row,fingerprint,club,shot_date,shot_time,ball_speed,club_speed,smash_factor,carry,total,roll,launch_angle,launch_direction,spin_rate,spin_axis,height,landing_angle,hang_time,curve,side_distance,face_angle,club_path,face_to_path,attack_angle,dynamic_loft,spin_loft,low_point,swing_plane,swing_direction,swing_radius,impact_height,impact_offset,d_plane,trajectory,target_distance,temperature,humidity,air_pressure,wind_speed,wind_direction,raw_values)
    values(v_session,v_player,(v_shot->>'row_number')::integer,v_shot->>'fingerprint',v_values->>'club',v_values->>'shot_date',v_values->>'shot_time',nullif(v_values->>'ball_speed','')::numeric,nullif(v_values->>'club_speed','')::numeric,nullif(v_values->>'smash_factor','')::numeric,nullif(v_values->>'carry','')::numeric,nullif(v_values->>'total','')::numeric,nullif(v_values->>'roll','')::numeric,nullif(v_values->>'launch_angle','')::numeric,nullif(v_values->>'launch_direction','')::numeric,nullif(v_values->>'spin_rate','')::numeric,nullif(v_values->>'spin_axis','')::numeric,nullif(v_values->>'height','')::numeric,nullif(v_values->>'landing_angle','')::numeric,nullif(v_values->>'hang_time','')::numeric,nullif(v_values->>'curve','')::numeric,nullif(v_values->>'side_distance','')::numeric,nullif(v_values->>'face_angle','')::numeric,nullif(v_values->>'club_path','')::numeric,nullif(v_values->>'face_to_path','')::numeric,nullif(v_values->>'attack_angle','')::numeric,nullif(v_values->>'dynamic_loft','')::numeric,nullif(v_values->>'spin_loft','')::numeric,nullif(v_values->>'low_point','')::numeric,nullif(v_values->>'swing_plane','')::numeric,nullif(v_values->>'swing_direction','')::numeric,nullif(v_values->>'swing_radius','')::numeric,nullif(v_values->>'impact_height','')::numeric,nullif(v_values->>'impact_offset','')::numeric,nullif(v_values->>'d_plane','')::numeric,v_values->>'trajectory',nullif(v_values->>'target_distance','')::numeric,nullif(v_values->>'temperature','')::numeric,nullif(v_values->>'humidity','')::numeric,nullif(v_values->>'air_pressure','')::numeric,nullif(v_values->>'wind_speed','')::numeric,nullif(v_values->>'wind_direction','')::numeric,v_shot->'raw_values') on conflict(player_id,fingerprint) do nothing;
    if found then v_inserted:=v_inserted+1; else v_duplicates:=v_duplicates+1; end if;
  end loop;
  update public.trackman_imports set accepted_rows=v_inserted,status='completed',import_metadata=import_metadata||jsonb_build_object('duplicate_shots',v_duplicates) where id=v_import;
  return jsonb_build_object('status','completed','import_id',v_import,'session_id',v_session,'inserted',v_inserted,'duplicates',v_duplicates);
end; $$;

alter table public.trackman_imports enable row level security; alter table public.trackman_sessions enable row level security; alter table public.trackman_shots enable row level security;
drop policy if exists "coaches read linked TrackMan imports" on public.trackman_imports;
drop policy if exists "coaches read linked TrackMan sessions" on public.trackman_sessions;
drop policy if exists "coaches read linked TrackMan shots" on public.trackman_shots;
drop policy if exists "players read own TrackMan sessions" on public.trackman_sessions;
drop policy if exists "players read own TrackMan shots" on public.trackman_shots;
create policy "coaches read linked TrackMan imports" on public.trackman_imports for select using(coach_id=auth.uid() and public.is_coach_of(player_id));
create policy "coaches read linked TrackMan sessions" on public.trackman_sessions for select using(coach_id=auth.uid() and public.is_coach_of(player_id));
create policy "coaches read linked TrackMan shots" on public.trackman_shots for select using(public.is_coach_of(player_id));
create policy "players read own TrackMan sessions" on public.trackman_sessions for select using(player_id=auth.uid());
create policy "players read own TrackMan shots" on public.trackman_shots for select using(player_id=auth.uid());
grant select on public.trackman_imports,public.trackman_sessions,public.trackman_shots to authenticated;
grant execute on function public.import_trackman_csv(jsonb) to authenticated;
