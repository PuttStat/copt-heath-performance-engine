# Package 7H.3 — Selected-player pilot and feedback

## Install

1. Run `supabase/migrations/202608220012_package_7h3_selected_player_pilot.sql` in Supabase SQL Editor.
2. Upload the remaining files to the matching GitHub folders, replacing `app/layout.tsx` and `app/ui/app-shell.tsx`.
3. Commit the changes and wait for Vercel to report **Ready**.

## Coach acceptance test

1. Sign in as a coach and open **Pilot**.
2. Select a linked player and choose **Enrol in pilot**.
3. Confirm the pilot shows Active, a start date and an eight-week target date.
4. Submit one coach checkpoint and add one test issue.
5. Move the issue to Review and then Resolved.

## Player acceptance test

1. Sign in as the enrolled player and open **Pilot**.
2. Confirm only that player's pilot is visible.
3. Submit onboarding feedback and week 2 feedback.
4. Add a low-severity usability issue.
5. Sign back in as coach and confirm both feedback entries and the issue appear.

The **Complete pilot** control is enabled after at least two player feedback checkpoints and no unresolved blockers. Completion never publishes private free-text feedback outside the player/linked-coach relationship.

## Database verification

```sql
select
  to_regclass('public.pilot_enrolments') as pilot_enrolments,
  to_regclass('public.pilot_feedback') as pilot_feedback,
  to_regclass('public.pilot_issues') as pilot_issues;
```

All three columns should return their table names.

To verify one real player, first find the UUID rather than entering placeholder text:

```sql
select id, display_name, email from public.profiles order by display_name;
```

Copy the required `id`, then use it in a query such as:

```sql
select * from public.pilot_enrolments where player_id = 'PASTE-REAL-UUID-HERE'::uuid;
```
