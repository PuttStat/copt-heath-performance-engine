# Vector Golf Performance — Package 7F.1

Package 7F.1 establishes the programme database, player questionnaire and editable 12-week architecture.

## Programme model

- Weeks 1–2: **Measure**
- Weeks 3–5: **Build**
- Weeks 6–8: **Stabilise**
- Weeks 9–10: **Transfer**
- Weeks 11–12: **Perform**
- Starting weekly allocation: **180 golf minutes + 60 Vector minutes**
- Review and retest points are built into weeks 2, 4, 6, 7, 8, 9, 10, 11 and 12.

Vector minutes support a demonstrated physical movement requirement. They do not replace golf diagnosis or automatically follow from a shot pattern.

## Install order

1. In Supabase SQL Editor, run `supabase/migrations/202608210005_package_7f1_programme_foundation.sql` once.
2. Upload all remaining package files to their matching GitHub folders.
3. Wait for Vercel to deploy the change.
4. Sign in and open **Programme**.

Only the migration SQL is run in Supabase. The application files go to GitHub.

## Validation sequence

1. Sign in as a linked player.
2. Complete the programme questionnaire, including goal, available minutes, days, facilities and consent.
3. Sign in as the linked coach and open **Programme**.
4. Select the player and choose **Create 12-week draft**.
5. Confirm exactly 12 weeks are created in the correct five phases.
6. Change a week's focus, golf minutes, Vector minutes and coach note.
7. Select **Publish programme**.
8. Sign in as the player and confirm the published programme is visible.

## Database check

```sql
select to_regclass('public.programme_intakes') as programme_intakes,
       to_regclass('public.programmes') as programmes,
       to_regclass('public.programme_weeks') as programme_weeks;

select p.title, p.status, count(w.id) as weeks
from public.programmes p
left join public.programme_weeks w on w.programme_id = p.id
group by p.id, p.title, p.status;
```

The second query should report `12` weeks for each newly created programme.

## Package boundary

Package 7F.1 creates the weekly structure and time budget. Package 7F.2 will place approved drills, tests and Vector exercises into individual sessions while ensuring weekly minutes reconcile with the programme allocation.
