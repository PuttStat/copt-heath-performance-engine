# Package 7G.2.1 · TrackMan Flat-field fallback correction

1. Run `supabase/migrations/202608220006_package_7g2_1_flat_field_fallbacks.sql` in Supabase SQL Editor. This immediately backfills previously imported shots from their preserved original values.
2. Upload `lib/trackman-import.ts` to the matching GitHub folder and replace the existing file. This corrects future imports.
3. Commit and wait for Vercel to redeploy.
4. Refresh **TrackMan** analysis.

Fallbacks applied only when the normal field is empty:

- Carry Flat - Length → Carry
- Carry Flat - Side → Offline
- Carry Flat - Land.Angle → Landing angle
- Est. Total Flat - Length → Total
- Height, Max Height, Apex and Flat height variants → Height

Verification:

```sql
select source_row,carry,side_distance,landing_angle,total,height
from public.trackman_shots
order by created_at desc,source_row;
```

The migration is repeat-safe and never overwrites an existing standard TrackMan value.
