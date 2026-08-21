# Vector Golf Performance — Package 7F.3

Package 7F.3 adds player session delivery, readiness and pain flags, block completion, session RPE/load, adherence, player notes and coach feedback.

## Install order

1. Run `supabase/migrations/202608210007_package_7f3_delivery_feedback.sql` in Supabase SQL Editor.
2. Upload the remaining files to their matching GitHub folders.
3. Wait for Vercel to deploy.
4. Sign in as a player and open **Practice**.

Only the migration file is run in Supabase.

## Response states

- **Performing:** strong readiness and energy with low soreness.
- **Stable:** no material readiness or safety concern.
- **Fatigued:** low readiness or high soreness/stress; continue only with appropriate modification.
- **Declining:** high pain or combined low readiness and energy; investigate before progressing.

Pain of 5/10 or higher generates `stop_and_review` and records the session as stopped. This is a conservative coaching safety flag, not a medical diagnosis.

## Validation sequence

1. As a player, open a released session.
2. Complete the readiness, energy, soreness, stress and pain check-in.
3. Confirm the calculated state and safety message appear.
4. Mark individual blocks complete.
5. Enter actual minutes, session RPE and a player note.
6. Complete the session and confirm adherence and session load update.
7. Test a temporary pain value of 5 and confirm the session becomes stopped with a coach-review warning.
8. Sign in as the linked coach, open **Practice** and select the player.
9. Review the response and publish a Keep, Progress, Modify or Stop decision with supporting evidence.
10. Sign back in as the player and confirm the coach feedback is visible.

## Database checks

```sql
select to_regclass('public.session_logs') as session_logs,
       to_regclass('public.block_completions') as block_completions,
       to_regclass('public.session_reviews') as session_reviews;

select completion_status, state, safety_status,
       actual_minutes, session_rpe, session_load
from public.session_logs
order by updated_at desc;
```

## Governing adjustment rule

Do not make a major programme change from one unusual session. Keep, Progress, Modify or Stop should reflect repeated performance evidence, the coach's supported diagnosis, transfer/no-aid results and the player's recovery response.

## Package boundary

Package 7F.3 records delivery and response. Package 7F.4 will aggregate those signals across weeks, manage retests and produce auditable next-week adjustment recommendations.
