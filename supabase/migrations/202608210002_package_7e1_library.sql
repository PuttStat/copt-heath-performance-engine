-- Vector Golf Performance · Package 7E.1 library foundation
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  item_type text not null check (item_type in ('golf_drill','vector_exercise')),
  title text not null,
  category text not null,
  stage text,
  purpose text not null,
  instructions text,
  dosage text,
  pass_criterion text,
  equipment text,
  guardrails text,
  media_url text,
  source_reference text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.diagnostic_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  fault_family text not null,
  observation text not null,
  evidence_required text not null,
  minimum_opportunities integer not null default 5,
  confidence_rule text not null,
  guardrail text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.diagnostic_library_links (
  diagnostic_rule_id uuid not null references public.diagnostic_rules(id) on delete cascade,
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  link_role text not null check (link_role in ('test','awareness','movement','contact','performance','physical_support')),
  rationale text,
  rank integer not null default 1,
  primary key (diagnostic_rule_id, library_item_id, link_role)
);
create table if not exists public.library_item_versions (
  id bigint generated always as identity primary key,
  library_item_id uuid not null references public.library_items(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (library_item_id, version)
);
create index if not exists library_items_type_category_idx on public.library_items(item_type, category, status);
create index if not exists diagnostic_rules_family_idx on public.diagnostic_rules(fault_family, status);
create or replace function public.is_library_editor()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('coach','admin')) $$;
create or replace function public.capture_library_item_version()
returns trigger language plpgsql security definer set search_path=public
as $$ begin if old is distinct from new then insert into public.library_item_versions(library_item_id,version,snapshot,changed_by) values(old.id,old.version,to_jsonb(old),auth.uid()) on conflict do nothing; new.version=old.version+1; new.updated_at=now(); end if; return new; end; $$;
drop trigger if exists library_item_version_trigger on public.library_items;
create trigger library_item_version_trigger before update on public.library_items for each row execute procedure public.capture_library_item_version();
alter table public.library_items enable row level security;
alter table public.diagnostic_rules enable row level security;
alter table public.diagnostic_library_links enable row level security;
alter table public.library_item_versions enable row level security;
drop policy if exists "authenticated read approved library" on public.library_items;
drop policy if exists "coaches read all library" on public.library_items;
drop policy if exists "coaches create library" on public.library_items;
drop policy if exists "coaches update library" on public.library_items;
drop policy if exists "coaches delete library" on public.library_items;
create policy "authenticated read approved library" on public.library_items for select using (status='approved' or public.is_library_editor());
create policy "coaches create library" on public.library_items for insert with check (public.is_library_editor());
create policy "coaches update library" on public.library_items for update using (public.is_library_editor()) with check (public.is_library_editor());
create policy "coaches delete library" on public.library_items for delete using (public.is_library_editor());
drop policy if exists "authenticated read approved rules" on public.diagnostic_rules;
drop policy if exists "coaches manage rules" on public.diagnostic_rules;
create policy "authenticated read approved rules" on public.diagnostic_rules for select using (status='approved' or public.is_library_editor());
create policy "coaches manage rules" on public.diagnostic_rules for all using (public.is_library_editor()) with check (public.is_library_editor());
drop policy if exists "authenticated read approved links" on public.diagnostic_library_links;
drop policy if exists "coaches manage links" on public.diagnostic_library_links;
create policy "authenticated read approved links" on public.diagnostic_library_links for select using (exists(select 1 from public.diagnostic_rules r where r.id=diagnostic_rule_id and (r.status='approved' or public.is_library_editor())));
create policy "coaches manage links" on public.diagnostic_library_links for all using (public.is_library_editor()) with check (public.is_library_editor());
drop policy if exists "coaches read versions" on public.library_item_versions;
create policy "coaches read versions" on public.library_item_versions for select using (public.is_library_editor());
grant select,insert,update,delete on public.library_items,public.diagnostic_rules,public.diagnostic_library_links to authenticated;
grant select on public.library_item_versions to authenticated;
grant usage,select on all sequences in schema public to authenticated;
