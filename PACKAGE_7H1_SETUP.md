# Vector Golf Performance · Package 7H.1

## Offline queue and reliable synchronisation

### Installation

1. Run `supabase/migrations/202608220010_package_7h1_offline_sync.sql` in Supabase SQL Editor.
2. Upload the remaining files to matching GitHub folders, including `public/sw.js`.
3. Commit and wait for Vercel to show **Ready**.
4. Open the deployed app and refresh once so the new service worker activates.

### Offline acceptance test

1. Sign in as a player and open **Rounds** while connected.
2. In the browser developer tools, set Network to **Offline**.
3. Record and save a quick round.
4. Confirm the persistent badge shows **Offline** and the round appears under `/sync` as pending.
5. Refresh the page while still offline. Confirm the app shell opens and the queued round remains listed.
6. Restore Network to **Online**.
7. Confirm the item synchronises automatically and disappears from the queue.
8. Check the round appears once in Performance; retrying must not create a duplicate.

Repeat the test with a detailed round. The round, band results and detailed shots must arrive together.

### Database verification

```sql
select r.id,r.sync_key,r.played_at,r.course_name,r.entry_mode,
       count(distinct b.id) as band_rows,
       count(distinct d.id) as detailed_shots
from public.rounds r
left join public.shot_band_results b on b.round_id=r.id
left join public.detailed_shots d on d.round_id=r.id
group by r.id
order by r.created_at desc
limit 10;
```

### Reliability rules

- Device storage is written before a network attempt begins.
- Existing localStorage round queues migrate automatically into IndexedDB.
- The round, band results and detailed shots are committed in one database transaction.
- The round UUID is the duplicate-safe synchronisation key.
- Failed operations retain their error, attempt count and next retry time.
- Retry delay increases progressively and is capped at 30 minutes.
- A queued item is bound to the signed-in player who created it.
- Manual discard requires confirmation and removes only the device copy.
- Connectivity and pending/failed states remain visible to the user.
