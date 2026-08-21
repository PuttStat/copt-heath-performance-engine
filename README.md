# Vector Golf Performance · Package 7F.3.1

This corrective package makes published coach session feedback reliably visible to the player.

## What changed

- Coach reviews are fetched directly from `session_reviews` by session-log ID instead of through a deeply nested relationship.
- The review is merged into its matching session before rendering.
- The first released session opens automatically after sign-in, so any published feedback is visible without an extra selection step.
- When a coach reopens a reviewed session, the existing decision, feedback and evidence are loaded back into the form.
- Supabase query errors are shown instead of silently hiding feedback.

## Install

Upload the included `app/practice/page.tsx` to the same path in GitHub and commit it to `main`. Vercel should redeploy automatically.

There is no SQL file in this corrective package. Do not run the earlier 7F.3 migration again.

## Test

1. Wait for the Vercel deployment to report **Ready**.
2. Sign in as the coach, open **Practice**, select the player and a completed session.
3. Confirm the previously published decision and feedback are still populated.
4. Sign out, then sign in as that player.
5. Open **Practice**. The first session opens automatically.
6. Select the reviewed session if it is in another week or session. Confirm the **Coach decision** panel displays the published feedback and supporting evidence.

If the app displays a feedback-loading error, copy the exact message; it will identify a remaining Supabase policy issue directly.
