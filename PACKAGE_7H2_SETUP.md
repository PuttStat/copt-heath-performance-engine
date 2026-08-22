# Vector Golf Performance · Package 7H.2

## Error handling, privacy, accessibility and backups

### Installation

1. Run `supabase/migrations/202608220011_package_7h2_resilience_privacy_backups.sql` in Supabase SQL Editor.
2. Upload the remaining files to matching GitHub folders.
3. Replace `app/ui/app-shell.tsx` and `app/layout.tsx` when prompted.
4. Commit and wait for Vercel to show **Ready**.
5. Sign in and open **Settings**.

### Privacy and export test

1. As a player, choose **Download data export**.
2. Open the JSON and confirm it identifies schema version `7H.2` and contains the player’s available rounds, programme, practice, diagnostic and TrackMan sections.
3. Confirm no other player’s records appear.
4. As coach, confirm the selector contains only linked players.

### Backup test

1. Select a player and choose **Create snapshot**.
2. Confirm a snapshot appears with timestamp, checksum and record counts.
3. Create additional snapshots and confirm only the latest five are retained.
4. Confirm a player cannot read another player’s snapshot and an unlinked coach cannot create or read one.

### Accessibility test

1. Reload a page and press Tab. Confirm **Skip to main content** appears and moves focus correctly.
2. Navigate controls using only Tab, Shift+Tab, Enter, Space and arrow keys.
3. Confirm focused controls have a clear gold outline.
4. Confirm the current navigation page exposes `aria-current="page"`.
5. Test at 200% browser zoom and a narrow mobile width without horizontal loss of primary controls.
6. Confirm status and error messages are announced without requiring colour alone.

### Error recovery test

Visit an invalid route and confirm the not-found recovery page appears. Application runtime errors use the recovery screen and create a minimal technical report containing route, message, error reference, connection state and abbreviated browser identifier—never form contents or player golf records.

### Database verification

```sql
select to_regclass('public.player_backup_snapshots') as backups,
       to_regclass('public.client_error_reports') as error_reports;
```

Both fields should return their table names.

```sql
select player_id,created_at,checksum,record_counts
from public.player_backup_snapshots
order by created_at desc;
```

### Recovery rule

Snapshots are logical recovery evidence. Package 7H.2 deliberately provides no one-click overwrite: restoration must be reviewed against the current record and performed as an explicit controlled operation. This prevents an old snapshot silently replacing newer player data.
