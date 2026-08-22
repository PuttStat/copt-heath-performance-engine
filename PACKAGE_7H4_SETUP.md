# Package 7H.4 — Production release and wider rollout

## Installation

1. Run `supabase/migrations/202608220013_package_7h4_production_rollout.sql` in Supabase SQL Editor.
2. Upload the remaining files to their matching GitHub folders, replacing `app/layout.tsx` and `app/ui/app-shell.tsx`.
3. Commit the files and wait for Vercel to show **Ready**.
4. Sign in as coach and open **Release**.

## Release acceptance test

1. Create a candidate such as version `1.0.0`.
2. Confirm eight required checks are created.
3. Add an evidence note and pass each check only after performing it.
4. Confirm approval remains locked if a check is pending/failed, there is no completed pilot, or an unresolved pilot blocker exists.
5. Complete the required pilot work in **Pilot**, then approve the candidate.
6. Create a small first cohort and start it.
7. Record a test critical incident and confirm the release status changes to **Paused**.
8. Resolve the underlying problem before resuming, or use **Mark rolled back** and follow the recorded rollback plan.

## Recommended cohort sequence

- Cohort 1: 5 supported players.
- Cohort 2: 10–20 players after Cohort 1 completes without a critical incident.
- Cohort 3: remaining invited players after review of adherence, errors, feedback and support demand.

Do not expand a cohort solely because a date has arrived. Expansion is a coach decision supported by resolved issues and completed checks.

## Database verification

```sql
select
  to_regclass('public.release_records') as release_records,
  to_regclass('public.release_check_items') as release_check_items,
  to_regclass('public.rollout_cohorts') as rollout_cohorts,
  to_regclass('public.release_incidents') as release_incidents;
```

All four columns should return their table names.
