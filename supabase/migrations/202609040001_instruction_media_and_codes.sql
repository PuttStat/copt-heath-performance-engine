-- Instructional media belongs to the content library, not the retired swing-analysis feature.
alter table public.library_items drop constraint if exists library_items_item_type_check;
alter table public.library_items
  add constraint library_items_item_type_check
  check (item_type in ('golf_drill','vector_exercise','swing_movement'));

alter table public.library_items
  add column if not exists media_provider text
    check (media_provider is null or media_provider in ('youtube','vimeo'));

create or replace function public.set_library_item_code_and_media()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  prefix text;
  category_code text;
  next_number integer;
begin
  if new.media_url is not null and btrim(new.media_url) <> '' then
    if new.media_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/' then
      new.media_provider := 'youtube';
    elsif new.media_url ~* '^https?://(www\.)?(vimeo\.com|player\.vimeo\.com)/' then
      new.media_provider := 'vimeo';
    else
      raise exception 'Instruction video must be a YouTube or Vimeo link';
    end if;
  else
    new.media_url := null;
    new.media_provider := null;
  end if;

  if new.code is null or btrim(new.code) = '' then
    category_code := upper(regexp_replace(coalesce(new.category, 'GENERAL'), '[^A-Za-z0-9]+', '', 'g'));
    category_code := substring(category_code from 1 for 8);
    if category_code = '' then category_code := 'GENERAL'; end if;
    prefix := case new.item_type
      when 'golf_drill' then 'DR-' || category_code || '-'
      when 'vector_exercise' then 'VEC-' || category_code || '-'
      when 'swing_movement' then 'VSM-' || category_code || '-'
    end;

    perform pg_advisory_xact_lock(hashtext('library-code:' || prefix));
    select coalesce(max((regexp_match(code, '([0-9]+)$'))[1]::integer), 0) + 1
      into next_number
      from public.library_items
      where code like prefix || '%' and code ~ '[0-9]+$';
    new.code := prefix || lpad(next_number::text, 2, '0');
  end if;
  return new;
end $$;

drop trigger if exists library_item_code_and_media_trigger on public.library_items;
create trigger library_item_code_and_media_trigger
before insert or update of code,item_type,category,media_url on public.library_items
for each row execute procedure public.set_library_item_code_and_media();
