-- Vector Golf Performance · Package 7G.2.1 TrackMan Flat-field fallbacks
create or replace function public.trackman_raw_number(source jsonb, candidate_keys text[])
returns numeric language plpgsql immutable as $$
declare item record; cleaned text;
begin
  for item in select key,value from jsonb_each_text(coalesce(source,'{}'::jsonb)) loop
    if regexp_replace(lower(item.key),'[^a-z0-9]','','g')=any(candidate_keys) and nullif(trim(item.value),'') is not null then
      cleaned:=regexp_replace(item.value,'[^0-9.+-]','','g');
      begin if nullif(cleaned,'') is not null then return cleaned::numeric; end if; exception when invalid_text_representation then null; end;
    end if;
  end loop;
  return null;
end; $$;

update public.trackman_shots set
 carry=coalesce(carry,public.trackman_raw_number(raw_values,array['carryflatlength'])),
 side_distance=coalesce(side_distance,public.trackman_raw_number(raw_values,array['carryflatside'])),
 landing_angle=coalesce(landing_angle,public.trackman_raw_number(raw_values,array['carryflatlandangle'])),
 total=coalesce(total,public.trackman_raw_number(raw_values,array['esttotalflatlength'])),
 height=coalesce(height,public.trackman_raw_number(raw_values,array['height','maxheight','apex','heightflat','maxheightflat']))
where carry is null or side_distance is null or landing_angle is null or total is null or height is null;

grant execute on function public.trackman_raw_number(jsonb,text[]) to authenticated;

do $$
declare populated integer;
begin
  select count(*) into populated from public.trackman_shots where carry is not null or side_distance is not null or landing_angle is not null or total is not null or height is not null;
  raise notice 'TrackMan shots with at least one flight result populated: %',populated;
end $$;
