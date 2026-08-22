# Vector Golf Performance · Package 7G.3

## Coach TrackMan diagnostic workspace

### Installation

1. Run `supabase/migrations/202608220008_package_7g3_trackman_diagnostics.sql` in Supabase SQL Editor.
2. Upload the remaining files to matching GitHub folders.
3. Replace `app/ui/app-shell.tsx` when prompted.
4. Commit and wait for Vercel to show **Ready**.
5. Sign in as coach and open **TrackMan**.

### End-to-end test

1. Select a linked player, TrackMan session and club.
2. Choose **Freeze evidence and review**.
3. Confirm a draft review appears with the shot count and evidence level captured.
4. Select an impact family.
5. Record the comparison test and its result.
6. Add a coach diagnosis and a separate player-facing explanation.
7. Search for and assign one player-ready golf drill or Vector exercise.
8. Approve the review.
9. Sign in as the player and open **Evidence**. Confirm the approved TrackMan review, player explanation and prescription are visible.
10. Create a second temporary review and test Reject and Supersede.

Approval must fail when the cause test, diagnosis, player explanation or prescription is missing.

### Audit verification

```sql
select c.id,c.status,c.trackman_club,c.impact_family,
       count(distinct v.id) as decision_versions,
       count(distinct rv.id) as prescription_events
from public.diagnostic_cases c
left join public.diagnostic_case_versions v on v.case_id=c.id
left join public.case_recommendation_versions rv on rv.case_id=c.id
where c.source_type='trackman'
group by c.id
order by c.created_at desc;
```

### Diagnostic safeguards

- The evidence snapshot is fixed when the review is created.
- TrackMan values may support a working hypothesis but never create an automatic diagnosis.
- A supported comparison test is mandatory before approval.
- Vector work requires a separately demonstrated movement requirement.
- Only approved cases and their prescriptions are visible to the player.
- Diagnostic edits, decisions and prescription additions/removals are retained in audit history.
