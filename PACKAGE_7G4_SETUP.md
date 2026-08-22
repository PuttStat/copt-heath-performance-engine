# Vector Golf Performance · Package 7G.4

## Coach player overview

### Installation

1. Run `supabase/migrations/202608220009_package_7g4_coach_overview.sql` in Supabase SQL Editor.
2. Upload the remaining files to matching GitHub folders.
3. Replace `app/ui/app-shell.tsx` when prompted.
4. Commit and wait for Vercel to show **Ready**.
5. Sign in as coach and open **Players**.

### Acceptance test

1. Confirm every linked player appears under **All players**.
2. Search by player name or email.
3. Switch to **Attention** and confirm only players with active flags appear.
4. Select a player and check programme state, current-week adherence, outstanding retests and incomplete sessions.
5. Confirm recent rounds and TrackMan sessions display independently.
6. Confirm the timeline includes available programme, practice, retest, diagnostic, round and TrackMan events.
7. Use the Evidence, Programme, Progress and TrackMan shortcuts.
8. Sign in as a player and confirm the Players navigation item is not visible.

### Priority model

- Stop and review flag: 8 points.
- Monitor flag: 4 points.
- Overdue retest: 3 points.
- Completed session awaiting coach feedback: 2 points.
- Draft diagnostic decision: 1 point.

The priority score orders coach work; it is not a player health score or diagnosis. Recent activity dates are not included in the priority score.

### Database verification

```sql
select public.coach_player_overview();
```

For one linked player:

```sql
select public.coach_player_history('PLAYER_UUID_HERE'::uuid);
```

Both functions enforce the existing coach-player relationship. The history is read-only and combines existing records without duplicating them.
