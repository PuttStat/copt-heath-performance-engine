# Package 7G.5 — Player TrackMan practice upload

## Installation

1. Run `supabase/migrations/202608220014_package_7g5_player_trackman_upload.sql` in Supabase SQL Editor.
2. Upload `app/trackman/page.tsx`, `app/trackman.css` and `app/ui/app-shell.tsx` to their matching GitHub folders, replacing the existing files.
3. Commit the changes and wait for Vercel to show **Ready**.

## Player acceptance test

1. Sign in as a player and confirm **TrackMan** appears in navigation.
2. Drag a TrackMan CSV over the field and confirm the field highlights and stages it.
3. Confirm the player selector is fixed to the signed-in player.
4. Choose Practice, Baseline, No-aid test, Transfer test or Retest.
5. Add a practice note and leave **Submit this session for coach review** selected.
6. Import and confirm the valid, rejected and mapped-field totals.
7. Upload the same CSV again and confirm it is rejected as a duplicate.

## Coach acceptance test

1. Sign in as the linked coach and open **TrackMan**.
2. Confirm the player-submitted session appears with status **submitted**.
3. Confirm the session is available to the existing analysis and diagnostic tools.
4. Confirm the player cannot assign a file to another player, edit measurements, approve a diagnosis or publish a prescription.

The existing fallback mappings remain active: `Carry Flat - Length`, `Carry Flat - Side`, `Carry Flat - Land.Angle`, `Est. Total Flat - Length` and `Max Height - Height`.

## Database verification

```sql
select upload_source, count(*) from public.trackman_imports group by upload_source;
select review_status, count(*) from public.trackman_sessions group by review_status;
```
