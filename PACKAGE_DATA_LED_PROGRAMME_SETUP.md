# Data-led programme recommendations

## What changes

- Coach-created weeks are pre-filled from the player's ranked evidence, coach-approved diagnostic prescriptions, facilities and available practice time.
- Each suggested drill and Vector exercise includes an explanation and remains editable before release.
- Players without a linked coach can generate a complete 12-week plan from their own evidence.
- Self-directed plans remain drafts when recovery or pain constraints require an exercise review.
- Players with a linked coach cannot bypass the coach-led planning route.

## Required database step

Run the following migration once in the Supabase SQL Editor:

`supabase/migrations/202609010001_data_led_programme_recommendations.sql`

No new Vercel environment variables are required.

## Verification

1. Sign in as a coach, open **Sessions**, select a player and an empty week.
2. Confirm the Vector recommendation summary identifies the player's leading evidence priority.
3. Select **Build suggested week**.
4. Confirm golf drills and a Vector exercise are already selected and each shows **Why Vector suggested this**.
5. Change one selection and confirm it saves as a coach override.
6. Release the reconciled week and verify it appears for the player.
7. For a player with no coach link, complete the Programme questionnaire and select **Generate my 12-week plan**.
8. Confirm all 12 weeks and their sessions are produced. If the questionnaire contains a recovery or pain constraint, confirm the plan remains a reviewable draft.

## Automated checks

```bash
npm run test:programme
npm run lint
npm run build
```
