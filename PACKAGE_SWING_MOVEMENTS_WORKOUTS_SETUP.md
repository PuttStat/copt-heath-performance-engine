# Swing movement aids and balanced Vector workouts

## Database step (required before the application deployment)

1. Open the Supabase project and select **SQL Editor**.
2. Open `supabase/migrations/202609020001_swing_movements_and_workouts.sql` from this repository.
3. Copy the entire file into a new Supabase query and choose **Run**.
4. Confirm the query succeeds. It creates the ten approved P1–P10 movement records and links an optional movement to each session block.

The migration is idempotent: it can be run again safely if the first attempt is interrupted.

## Coach check

1. Sign in as a coach and open **Sessions**.
2. Choose a player and an empty programme week, then select **Build suggested week**.
3. Confirm each full-swing golf drill has a preselected **Swing movement aid** dropdown. Change the selection and confirm it persists.
4. Confirm putting and short-game drills default to **No P-system movement**, because the model describes a stock 7-iron rather than those techniques.
5. Confirm each Vector workout contains multiple blocks and that the Golf and Vector totals still show **Ready to release**.
6. Release the week.

## Player check

1. Sign in as the linked player and open **Practice**.
2. Open the released session.
3. Confirm the drill instructions are followed by the assigned P-position card, including body, pressure, hands/arms, shaft/face, rehearsal and acceptance gate.
4. Confirm every Vector exercise appears as its own completable block.

## Existing weeks

Existing session blocks are left unchanged. Rebuild an unreleased empty week to see automatic movement selection and the multi-exercise workout composition. Coaches may also edit existing golf blocks and select a movement manually.
