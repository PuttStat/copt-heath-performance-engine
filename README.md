# Vector Golf Performance — Package 7F.4

Package 7F.4 adds the weekly progression and retesting layer. It aggregates the player's completed work and response data, manages structured retests, and gives the coach an auditable Keep, Progress, Modify or Stop workflow for the next week.

## Install order

1. Run `supabase/migrations/202608220001_package_7f4_progression_retests.sql` in the Supabase SQL Editor.
2. Upload the remaining files to their matching GitHub folders.
3. Wait for Vercel to deploy.
4. Sign in as the coach and open **Progress**.

Only the migration file is run in Supabase.

## What the weekly evidence includes

- planned and completed minutes;
- adherence percentage;
- completed sessions;
- average readiness;
- accumulated session load;
- repeated performing, fatigued or declining responses;
- safety/monitor flags;
- coach Stop decisions; and
- reviewed retests.

The engine suggestion is deliberately conservative:

- **Stop** when a safety flag or coach Stop decision exists;
- **Modify** when adherence is below 60% or repeated fatigued/declining responses exist;
- **Progress** when adherence is at least 80%, at least two sessions are complete and at least two responses are performing, with no safety trigger;
- **Keep** otherwise.

This is a suggestion only. The coach must choose and explain the published decision.

## Retest types

- **Baseline:** establishes the starting measure.
- **No-aid:** checks whether the change remains without a constraint or training aid.
- **Transfer:** tests the skill under representative variability or pressure.
- **Outcome:** checks whether the performance outcome has improved.

## Validation sequence

1. As the coach, open **Progress** and select the linked player.
2. Select a week containing completed practice sessions.
3. Confirm adherence, session completion, readiness, load and flags agree with the Practice page.
4. Schedule a no-aid or transfer retest with a clear protocol and success criterion.
5. Sign in as the player, open **Progress**, select the week and record the retest result.
6. Sign back in as the coach and review the submitted result.
7. Confirm the evidence-led suggestion is visible but remains editable.
8. Enter a rationale, next-week focus and recommended golf/Vector minutes.
9. Save a draft and confirm it is not visible to the player.
10. Publish a decision and confirm the player can see the decision, rationale, focus and minute recommendation.
11. Change and republish a decision, then confirm the earlier decision remains in the coach's decision history.

## Database checks

```sql
select to_regclass('public.programme_retests') as programme_retests,
       to_regclass('public.week_adjustments') as week_adjustments,
       to_regclass('public.week_adjustment_versions') as week_adjustment_versions;

select retest_type, title, status, result_value, unit, transfer_passed
from public.programme_retests
order by created_at desc;

select decision, status, rationale, evidence_snapshot, published_at
from public.week_adjustments
order by created_at desc;
```

## Governing rules

- Round data identifies where gains matter; it does not select a swing drill automatically.
- A programme change must not be based on one unusual session.
- A physical intervention is included only when a movement requirement supports the golf intervention.
- Safety flags stop progression; they are coaching safeguards, not medical diagnoses.
- Published decisions retain their evidence snapshot and all later edits create an audit version.
- Package 7F.4 recommends the next-week change but does not silently rewrite a released week.
