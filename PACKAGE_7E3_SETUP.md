# Vector Golf Performance — Package 7E.3

Package 7E.3 adds the coach player workspace. A coach can select any linked player, inspect that player's weighted performance evidence, create a review, edit the drill and Vector exercise route, add a coaching note, and approve, reject or supersede the prescription.

## Install order

1. In Supabase SQL Editor, run `supabase/migrations/202608210004_package_7e3_coach_workspace.sql` once.
2. Upload the remaining package files to the matching folders in GitHub.
3. Wait for Vercel to deploy the new commit.
4. Sign in with a profile whose role is `coach` or `admin` and open **Coach**.

Only the migration file is run in Supabase. The application files go to GitHub.

## Link the first player

The player must sign in once so that a row exists in `public.profiles`. Then run the following in Supabase SQL Editor, replacing both email addresses:

```sql
insert into public.coach_player_links (coach_id, player_id)
select coach.id, player.id
from public.profiles coach
cross join public.profiles player
where lower(coach.email) = lower('coach@example.com')
  and lower(player.email) = lower('player@example.com')
on conflict do nothing;
```

## Validation

1. Confirm the linked player appears in the player selector.
2. Confirm their round count, evidence and saved reviews load.
3. Create a review from a band with at least five opportunities.
4. Open the draft review and add a coach note.
5. Search the library and add a drill or Vector exercise.
6. Remove one temporary item.
7. Approve the prescription.
8. Sign in as the player and confirm only the approved prescription is visible under **Evidence**.

## Security check

```sql
select coach.email as coach, player.email as player
from public.coach_player_links link
join public.profiles coach on coach.id = link.coach_id
join public.profiles player on player.id = link.player_id;
```

All player data remains protected by the existing row-level security rules. A coach can read and change recommendations only for a linked player.
