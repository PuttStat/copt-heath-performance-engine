# Package 7G.2.2 · Peak-height fallback

1. Run `supabase/migrations/202608220007_package_7g2_2_peak_height_fallback.sql` in Supabase SQL Editor to update existing imported shots.
2. Upload and replace `lib/trackman-import.ts` in GitHub so future imports map the field automatically.
3. Commit and wait for Vercel to redeploy.
4. Refresh TrackMan analysis.

Mapping: `Max Height - Height` → Peak height, used only where Height is currently empty.

Verification:

```sql
select source_row,height,raw_values->>'Max Height - Height' as source_height
from public.trackman_shots
order by created_at desc,source_row;
```
