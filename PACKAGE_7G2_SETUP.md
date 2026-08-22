# Vector Golf Performance · Package 7G.2

## TrackMan session analysis

### Installation

1. Run `supabase/migrations/202608220005_package_7g2_trackman_analysis.sql` in Supabase SQL Editor.
2. Upload the remaining files to the matching GitHub folders.
3. Replace `app/ui/app-shell.tsx` when prompted.
4. Commit the changes and wait for Vercel to show **Ready**.
5. Sign in as coach and open **TrackMan**.

### Acceptance test

1. Select the linked player used for the 7G.1 import.
2. Select the imported TrackMan session and a club.
3. Confirm the dispersion chart, evidence flags, metric groups and shot table load.
4. With only three sample shots, confirm the evidence panel reports **More shots required** while still showing the measurements.
5. Mark the session **Baseline** and refresh. Confirm the label persists.
6. Import or select another session, mark it **Retest**, then choose the baseline under **Compare with**.
7. Confirm shared metrics show the current mean and change from reference.
8. Check a field absent from the CSV: it must display `—` or zero coverage, not zero as a measured result.

### Database verification

```sql
select id, title, session_date, test_type, comparison_group
from public.trackman_sessions
order by created_at desc;
```

### Interpretation rules

- Fewer than five selected shots is insufficient evidence for a pattern flag.
- Standard deviation and coverage are displayed with the mean.
- Comparisons describe the selected samples only.
- Missing tiles do not generate inferred values.
- Evidence flags describe measured variability or dispersion and do not diagnose a swing cause.
- Coaches should compare like-for-like club, task, environment and strike conditions.
