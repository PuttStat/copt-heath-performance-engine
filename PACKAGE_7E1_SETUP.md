# Package 7E.1 installation

Package 7E.1 adds the structured knowledge-library foundation, 224 coded golf-drill routes, 31 initial VECTOR exercises, seven diagnostic entry gates and a coach-only Library Manager.

## Installation order

In Supabase **SQL Editor**, run these files in order. Create a new query for each file and copy its complete contents.

1. `supabase/migrations/202608210002_package_7e1_library.sql`
2. `supabase/seeds/202608210002_7e1_golf_drills.sql`
3. `supabase/seeds/202608210003_7e1_vector_exercises.sql`
4. `supabase/seeds/202608210004_7e1_diagnostic_rules.sql`

The seed files use stable codes and `on conflict`, so they can be run again safely after an interrupted import.

Then upload the complete Package 7E.1 project to the GitHub repository root, replacing existing files. Wait for Vercel to show **Ready**.

## Verification query

```sql
select item_type, count(*)
from public.library_items
group by item_type
order by item_type;

select count(*) as diagnostic_rules
from public.diagnostic_rules;
```

Expected initial results:

- `golf_drill`: 224
- `vector_exercise`: 31
- `diagnostic_rules`: 7

## Coach Library Manager

Sign in as the coach and open **Library**. The coach can:

- search by code, title, category or purpose;
- filter golf drills and VECTOR exercises;
- add a new draft record;
- approve or retire a record;
- inspect the source and version number.

Every edit stores the previous record in `library_item_versions` and increments the visible version. Players can read only approved content. Coaches and administrators can inspect drafts and retired records.

## Future bulk additions

`data/library_import_template.csv` defines the controlled import columns. Package 7E.1 provides the template and database structure; a coach can already add individual records in the app. Bulk CSV upload can be added after the library fields have been tested with real content.

## Guardrail

The seven diagnostic rules are entry gates, not automatic swing diagnoses. Package 7E.2 will evaluate evidence and link supported rules to staged drills and physical-support exercises.
