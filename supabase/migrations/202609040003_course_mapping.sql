create table if not exists public.course_catalog (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('golf_intelligence')),
  provider_course_id text not null,
  name text not null,
  country_code text,
  region text,
  updated_by_provider_at timestamptz,
  imported_at timestamptz not null default now(),
  raw_metadata jsonb not null default '{}'::jsonb,
  unique(provider, provider_course_id)
);

create table if not exists public.course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course_catalog(id) on delete cascade,
  provider_hole_id integer not null,
  hole_number integer not null check (hole_number between 1 and 36),
  par integer check (par between 2 and 7),
  yardage integer check (yardage is null or yardage > 0),
  tee_latitude double precision,
  tee_longitude double precision,
  green_front_latitude double precision,
  green_front_longitude double precision,
  green_center_latitude double precision,
  green_center_longitude double precision,
  green_back_latitude double precision,
  green_back_longitude double precision,
  unique(course_id, provider_hole_id)
);

create table if not exists public.course_features (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course_catalog(id) on delete cascade,
  hole_id uuid references public.course_holes(id) on delete cascade,
  provider_hole_id integer,
  feature_type text not null,
  geometry jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists course_holes_number_idx on public.course_holes(course_id,hole_number);
create index if not exists course_features_hole_idx on public.course_features(hole_id,feature_type);

alter table public.rounds add column if not exists course_id uuid references public.course_catalog(id) on delete set null;

create table if not exists public.mapped_shots (
  id uuid primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  course_hole_id uuid references public.course_holes(id) on delete set null,
  hole_number integer not null check (hole_number between 1 and 36),
  shot_sequence integer not null check (shot_sequence > 0),
  club text,
  start_latitude double precision not null,
  start_longitude double precision not null,
  end_latitude double precision not null,
  end_longitude double precision not null,
  start_lie text not null,
  end_lie text not null,
  distance_yards double precision check (distance_yards >= 0),
  distance_to_green_yards double precision check (distance_to_green_yards >= 0),
  success boolean not null,
  penalty boolean not null default false,
  created_at timestamptz not null default now(),
  unique(round_id,hole_number,shot_sequence)
);
create index if not exists mapped_shots_player_idx on public.mapped_shots(player_id,created_at desc);

alter table public.course_catalog enable row level security;
alter table public.course_holes enable row level security;
alter table public.course_features enable row level security;
alter table public.mapped_shots enable row level security;

create policy "players read course catalog" on public.course_catalog for select to authenticated using (true);
create policy "players read course holes" on public.course_holes for select to authenticated using (true);
create policy "players read course features" on public.course_features for select to authenticated using (true);
create policy "library editors manage courses" on public.course_catalog for all to authenticated using (public.is_library_editor()) with check (public.is_library_editor());
create policy "library editors manage course holes" on public.course_holes for all to authenticated using (public.is_library_editor()) with check (public.is_library_editor());
create policy "library editors manage course features" on public.course_features for all to authenticated using (public.is_library_editor()) with check (public.is_library_editor());
create policy "players and coaches read mapped shots" on public.mapped_shots for select to authenticated using (player_id=auth.uid() or public.is_coach_of(player_id));
create policy "players manage own mapped shots" on public.mapped_shots for all to authenticated using (player_id=auth.uid()) with check (player_id=auth.uid());

grant select on public.course_catalog,public.course_holes,public.course_features to authenticated;
grant insert,update,delete on public.course_catalog,public.course_holes,public.course_features to authenticated;
grant select,insert,update,delete on public.mapped_shots to authenticated;

create or replace function public.sync_round_payload(payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare round_id uuid:=(payload->>'id')::uuid;target_player uuid:=(payload->>'player_id')::uuid;band jsonb;shot jsonb;band_count integer:=0;shot_count integer:=0;mapped_count integer:=0;
begin
 if auth.uid() is null or target_player<>auth.uid() then raise exception 'Round can only be synced by its player';end if;
 if exists(select 1 from rounds where sync_key=round_id and player_id<>target_player) then raise exception 'Synchronisation key belongs to another player';end if;
 insert into rounds(id,player_id,played_at,course_name,course_id,entry_mode,sync_key)
 values(round_id,target_player,(payload->>'recordedAt')::timestamptz,coalesce(nullif(payload->>'courseName',''),'Not recorded'),nullif(payload->>'courseId','')::uuid,coalesce(nullif(payload->>'entryMode',''),'quick')::round_entry_mode,round_id)
 on conflict(sync_key) do update set played_at=excluded.played_at,course_name=excluded.course_name,course_id=excluded.course_id,entry_mode=excluded.entry_mode,updated_at=now();
 for band in select value from jsonb_array_elements(coalesce(payload->'bands','[]'::jsonb)) loop if band->>'opportunities' is not null then insert into shot_band_results(round_id,player_id,shot_band,opportunities,successes) values(round_id,target_player,band->>'label',(band->>'opportunities')::integer,nullif(band->>'successes','')::integer) on conflict(round_id,shot_band) do update set opportunities=excluded.opportunities,successes=excluded.successes;band_count:=band_count+1;end if;end loop;
 for shot in select value from jsonb_array_elements(coalesce(payload->'detailedShots','[]'::jsonb)) loop if exists(select 1 from detailed_shots where id=(shot->>'id')::uuid and player_id<>target_player) then raise exception 'Shot synchronisation key belongs to another player';end if;insert into detailed_shots(id,round_id,player_id,hole_number,shot_sequence,shot_band,success,miss_length,miss_direction) values((shot->>'id')::uuid,round_id,target_player,(shot->>'holeNumber')::integer,(shot->>'sequence')::integer,shot->>'shotBand',(shot->>'success')::boolean,nullif(shot->>'missLength',''),nullif(shot->>'missDirection','')) on conflict(id) do update set shot_band=excluded.shot_band,success=excluded.success,miss_length=excluded.miss_length,miss_direction=excluded.miss_direction;shot_count:=shot_count+1;end loop;
 for shot in select value from jsonb_array_elements(coalesce(payload->'mappedShots','[]'::jsonb)) loop
   insert into mapped_shots(id,round_id,player_id,course_hole_id,hole_number,shot_sequence,club,start_latitude,start_longitude,end_latitude,end_longitude,start_lie,end_lie,distance_yards,distance_to_green_yards,success,penalty)
   values((shot->>'id')::uuid,round_id,target_player,nullif(shot->>'courseHoleId','')::uuid,(shot->>'holeNumber')::integer,(shot->>'sequence')::integer,nullif(shot->>'club',''),(shot->>'startLatitude')::double precision,(shot->>'startLongitude')::double precision,(shot->>'endLatitude')::double precision,(shot->>'endLongitude')::double precision,shot->>'startLie',shot->>'endLie',(shot->>'distanceYards')::double precision,(shot->>'distanceToGreenYards')::double precision,(shot->>'success')::boolean,coalesce((shot->>'penalty')::boolean,false))
   on conflict(id) do update set club=excluded.club,end_latitude=excluded.end_latitude,end_longitude=excluded.end_longitude,end_lie=excluded.end_lie,distance_yards=excluded.distance_yards,distance_to_green_yards=excluded.distance_to_green_yards,success=excluded.success,penalty=excluded.penalty;
   mapped_count:=mapped_count+1;
 end loop;
 return jsonb_build_object('status','synced','round_id',round_id,'bands',band_count,'shots',shot_count,'mapped_shots',mapped_count);
end $$;
grant execute on function public.sync_round_payload(jsonb) to authenticated;

create or replace view public.round_traditional_metrics with (security_invoker=true) as
select r.id as round_id,r.player_id,
  count(*) filter(where ms.shot_sequence=1 and ch.par in (4,5))::integer as fairway_opportunities,
  count(*) filter(where ms.shot_sequence=1 and ch.par in (4,5) and ms.end_lie='fairway')::integer as fairways_hit,
  count(distinct ms.hole_number) filter(where ms.end_lie in ('green','in_hole') and ms.shot_sequence<=ch.par-2)::integer as greens_in_regulation,
  count(*) filter(where lower(coalesce(ms.club,''))='putter' or ms.start_lie='green')::integer as putts,
  round((avg(ms.distance_yards) filter(where ms.shot_sequence=1 and lower(coalesce(ms.club,''))='driver'))::numeric,1) as average_drive_yards,
  count(*) filter(where ms.penalty)::integer as penalties,
  round(100.0*count(*) filter(where ms.success)/nullif(count(*),0),1) as vector_success_rate
from public.rounds r
left join public.mapped_shots ms on ms.round_id=r.id
left join public.course_holes ch on ch.id=ms.course_hole_id
group by r.id,r.player_id;
grant select on public.round_traditional_metrics to authenticated;
