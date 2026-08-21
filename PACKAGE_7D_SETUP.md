# Package 7D installation

## 1. Update GitHub

Upload the extracted Package 7D contents to the repository root and replace existing files. Vercel will deploy automatically.

## 2. Run the incremental database migration

In Supabase **SQL Editor**, create a new query using the complete contents of:

`supabase/migrations/202608210001_package_7d.sql`

Run it once. It adds `detailed_shots`, indexes and four Row Level Security policies. It does not replace or delete existing rounds.

## 3. Verify the migration

```sql
select
  to_regclass('public.detailed_shots') as detailed_shots,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public' and c.relname = 'detailed_shots'
group by c.relrowsecurity;
```

Expected: `detailed_shots`, `true`, `4`.

## 4. Acceptance check

1. Sign in and confirm the dashboard greets the authenticated profile by name.
2. Confirm the existing test round appears in the round count and engine priorities.
3. Open **Rounds → Detailed hole-by-hole**.
4. Add successful and failed shots across two holes, including one miss direction and length.
5. Save and confirm `rounds`, `shot_band_results` and `detailed_shots` all receive records.
6. Confirm the Performance page ranks the most frequent unsuccessful band above a rare isolated failure.
