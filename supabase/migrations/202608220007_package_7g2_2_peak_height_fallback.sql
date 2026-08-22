-- Vector Golf Performance · Package 7G.2.2 peak-height fallback
update public.trackman_shots
set height=public.trackman_raw_number(raw_values,array['maxheightheight'])
where height is null
  and public.trackman_raw_number(raw_values,array['maxheightheight']) is not null;

do $$
declare populated integer;
begin
  select count(*) into populated from public.trackman_shots where height is not null;
  raise notice 'TrackMan shots with peak height populated: %',populated;
end $$;
