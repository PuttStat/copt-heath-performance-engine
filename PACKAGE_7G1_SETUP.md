# Vector Golf Performance · Package 7G.1

## TrackMan import foundation

This package adds coach-controlled TrackMan CSV staging, validation, player/session assignment, audit retention and duplicate protection.

## Installation

1. In Supabase SQL Editor, create a new query.
2. Paste and run the complete contents of:
   `supabase/migrations/202608220004_package_7g1_trackman_import.sql`
3. Upload the remaining package files to the matching folders in the GitHub repository, replacing `app/ui/app-shell.tsx` when prompted.
4. Commit the changes and wait for Vercel to show **Ready**.
5. Sign in as a coach and open **TrackMan**.

## Acceptance test

1. Select the supplied representative TrackMan CSV.
2. Confirm the staging summary reports 3 valid shots and 61 source columns.
3. Select a linked player, add a session title/date, and choose **Import validated shots**.
4. Confirm the recent-import row reports 3 shots.
5. Select the identical file again and import it. The app must report a duplicate upload and add zero shots.

Missing optional data tiles or blank cells are valid and remain null. A row is rejected only when it contains no recognised shot measurement. Rejected rows and warnings are retained in the import metadata.

## Database verification

```sql
select i.file_name, i.status, i.accepted_rows, i.rejected_rows,
       s.title, s.session_date, count(sh.id) as stored_shots
from public.trackman_imports i
join public.trackman_sessions s on s.import_id = i.id
left join public.trackman_shots sh on sh.session_id = s.id
group by i.id, s.id
order by i.created_at desc;
```

To confirm all original values were preserved:

```sql
select source_row, club, ball_speed, club_speed, carry,
       jsonb_object_length(raw_values) as original_columns
from public.trackman_shots
order by created_at desc, source_row
limit 10;
```

## Data safeguards

- Only coaches linked to the selected player can import for that player.
- The exact same file cannot be imported twice by the same coach.
- A shot fingerprint prevents the same shot being reintroduced through a differently named file.
- Players can read only their own sessions and shots.
- Original headers and row values are preserved in JSON alongside analysis-ready numeric fields.
- Blank optional values do not invalidate a row or file.
