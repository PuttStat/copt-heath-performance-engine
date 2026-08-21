-- Vector Golf Performance · Package 7E.4.1 instructional library framework
alter table public.library_items add column if not exists setup text;
alter table public.library_items add column if not exists intention text;
alter table public.library_items add column if not exists progression text;
alter table public.library_items add column if not exists regression text;
alter table public.library_items add column if not exists instruction_complete boolean
generated always as (
  nullif(btrim(coalesce(setup,'')),'') is not null and
  nullif(btrim(coalesce(instructions,'')),'') is not null and
  nullif(btrim(coalesce(dosage,'')),'') is not null and
  nullif(btrim(coalesce(pass_criterion,'')),'') is not null
) stored;
comment on column public.library_items.setup is 'Starting position, alignment, equipment placement or other preparation.';
comment on column public.library_items.instructions is 'Plain-language, ordered instructions explaining exactly how to perform the drill or movement.';
comment on column public.library_items.intention is 'What the player should try to create, notice or feel.';
comment on column public.library_items.progression is 'How to make the drill or movement more demanding or representative.';
comment on column public.library_items.regression is 'How to simplify the drill or movement when required.';
comment on column public.library_items.instruction_complete is 'True when setup, instructions, dosage and success check are populated.';
create index if not exists library_items_instruction_complete_idx on public.library_items(item_type,instruction_complete,status);
grant select,insert,update,delete on public.library_items to authenticated;
