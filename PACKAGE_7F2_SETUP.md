# Vector Golf Performance — Package 7F.2

Package 7F.2 converts each programme week into timed sessions and approved-library blocks.

## What it enforces

- Golf session minutes must exactly equal the week's golf allocation.
- Vector minutes must exactly equal the week's Vector allocation.
- Every released block must have an approved library item.
- Round data does not select a swing drill; automatic assignments come only from a coach-approved diagnostic prescription.
- A coach can replace an assignment from the approved library.
- Vector work supports a demonstrated movement requirement and should not create unnecessary fatigue.
- Every block edit is captured in the version history.

## Install order

1. Run `supabase/migrations/202608210006_package_7f2_session_builder.sql` in Supabase SQL Editor.
2. Upload the remaining files to their matching GitHub folders.
3. Wait for Vercel to deploy.
4. Open **Sessions** as a coach.

Only the migration file is run in Supabase.

## Test sequence

1. Select a linked player with a Package 7F.1 programme.
2. Select week 1 and choose **Build suggested week**.
3. Confirm three sessions are created.
4. Confirm the golf and Vector totals exactly match the weekly allocations.
5. If a block is unassigned, select an appropriate approved drill or Vector exercise.
6. Change one block's minutes so the totals no longer reconcile; **Release week** must become unavailable.
7. Restore the exact total.
8. Release the week.
9. Sign in as the player and confirm only the released week and assigned work are visible.

## Database checks

```sql
select to_regclass('public.programme_sessions') as programme_sessions,
       to_regclass('public.session_blocks') as session_blocks,
       to_regclass('public.session_block_versions') as session_block_versions;

select w.week_number,
       w.golf_minutes as planned_golf,
       totals.golf_minutes as session_golf,
       w.vector_minutes as planned_vector,
       totals.vector_minutes as session_vector,
       totals.unassigned_blocks
from public.programme_weeks w
cross join lateral public.week_session_totals(w.id) totals
order by w.week_number;
```

For a releasable week, planned and session minutes must match and `unassigned_blocks` must be zero.

## Package boundary

Package 7F.2 builds and releases sessions. Package 7F.3 will add player completion, session RPE, pain/readiness checks, adherence and coach feedback.
