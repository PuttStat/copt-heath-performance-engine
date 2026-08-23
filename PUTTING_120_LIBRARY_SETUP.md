# Vector Putting Drill Library — 120 drills

This package adds 120 approved, player-ready putting drills:

- `PUT-SC-01`–`PUT-SC-30`: Speed Control
- `PUT-FA-01`–`PUT-FA-30`: Face Alignment
- `PUT-SQ-01`–`PUT-SQ-30`: Square Face at Impact
- `PUT-CP-01`–`PUT-CP-30`: Club Path

Every record contains a title, discipline, development stage, purpose, setup, numbered instructions, intention, equipment, dose, success check, progression and regression.

## Installation

1. Run `supabase/seeds/202608230001_putting_120_drill_library.sql` in Supabase SQL Editor.
2. No application-file replacement or Vercel deployment is required.
3. Refresh **Library**, filter **Golf drills** and search `PUT-`.

The seed is repeat-safe. It updates a coded drill only when its content differs. The final validation requires exactly 30 drills in each discipline, exactly 120 putting drills and all 120 to be player-ready.

## Verification

```sql
select
  category,
  count(*) as drills,
  count(*) filter (where instruction_complete) as player_ready
from public.library_items
where code like 'PUT-%'
group by category
order by category;
```

Each discipline should show 30 drills and 30 player-ready records.
