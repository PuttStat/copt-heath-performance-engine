# Vector Golf Performance — Package 7E.2

Package 7E.2 adds the evidence and recommendation engine. It converts weighted shot-band performance and detailed miss records into ranked observations, applies sample-size confidence, suggests library routes, and requires coach approval before a player can see a prescription.

## Install order

1. In Supabase SQL Editor, run `supabase/migrations/202608210003_package_7e2_recommendations.sql` once.
2. Upload the remaining application files to the GitHub repository, preserving their folders.
3. Allow Vercel to deploy the new commit.
4. Sign in as the coach and open **Evidence**.

Do not upload the application files to Supabase. Only the migration SQL is run in Supabase.

## Coach validation

1. Confirm shot bands appear in weighted priority order.
2. Confirm fewer than five opportunities shows **Insufficient** and disables review creation.
3. On a band with enough evidence, select **Create coach review**.
4. Confirm the new case appears as **Draft** and is not visible to a player.
5. Approve the case and confirm it becomes visible when that player signs in.
6. Reject a temporary case and confirm it remains hidden from the player.

## Database validation

```sql
select to_regclass('public.diagnostic_cases') as diagnostic_cases,
       to_regclass('public.case_recommendations') as case_recommendations;

select status, count(*)
from public.diagnostic_cases
group by status
order by status;
```

## Clinical and coaching guardrails

- An on-course miss is an observation, not proof of a swing or physical cause.
- Fewer than five opportunities cannot generate a coach review.
- Directional confidence increases only when miss fields are completed consistently.
- Vector exercises are physical-support options and still require screening and coach judgement.
- Only approved cases are available through player row-level security.

## Package boundary

This package analyses the signed-in player's current round data. Coach player-selection and multi-player case management are reserved for the next coach-workspace package. TrackMan evidence will extend the same case model in Package 7G.
