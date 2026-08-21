# Vector Golf Performance — Package 7E.4.1

Package 7E.4.1 adds the instructional framework required to explain exactly how a player performs every golf drill and Vector movement exercise.

## Install order

1. Run `supabase/migrations/202608220002_package_7e4_1_instruction_framework.sql` in the Supabase SQL Editor.
2. Upload the remaining files to their matching GitHub folders.
3. Wait for Vercel to redeploy.
4. Sign in as a coach and open **Library**.

Only the migration file is run in Supabase.

## Instruction structure

Each library item can now contain:

- purpose;
- setup or starting position;
- equipment;
- plain-language instructions explaining what to do;
- intention or feel;
- dose;
- success check;
- progression; and
- regression.

No general safety information is added by this package.

## Player-ready calculation

An item is automatically marked **Player ready** when all four essential fields contain content:

1. setup;
2. instructions;
3. dose; and
4. success check.

Existing library records remain available but show **Needs instructions** until these fields are completed. This allows Packages 7E.4.2 and 7E.4.3 to populate the content progressively without removing the current library.

## Coach workflow

1. Open **Library**.
2. Search for a drill or Vector exercise.
3. Select **Edit instructions**.
4. Complete or revise the instructional fields.
5. Choose Draft, Approved or Retired status.
6. Select **Save instructions**.

Every saved edit uses the existing library version trigger, retaining the previous record in `library_item_versions`.

## Player workflow

When a completed instruction record is assigned to a released practice session, the player sees:

- the coach's session-specific instruction;
- purpose;
- setup;
- equipment when required;
- what to do;
- intention or feel;
- dose;
- success check; and
- available progression or regression.

If the content has not yet been completed, the session displays **Full instructions are being prepared by your coach** rather than presenting incomplete guidance as finished content.

## Validation sequence

1. Run the migration and confirm it completes successfully.
2. Sign in as coach and open **Library**.
3. Confirm the summary shows the number of items requiring instructions.
4. Search for one approved golf drill and select **Edit instructions**.
5. Complete Setup, How to perform it, Dose and Success check, then save.
6. Confirm the item changes from **Needs instructions** to **Player ready** and its version number increases.
7. Repeat with one Vector exercise.
8. Assign either completed item to a published session.
9. Sign in as the player, open **Practice** and begin that session.
10. Confirm the full instructions appear inside the assigned block.

## Database checks

```sql
select item_type,
       count(*) as total,
       count(*) filter (where instruction_complete) as player_ready,
       count(*) filter (where not instruction_complete) as needs_instructions
from public.library_items
group by item_type
order by item_type;

select code, title, instruction_complete, version
from public.library_items
order by instruction_complete, code;
```

## Package boundary

Package 7E.4.1 provides the database fields, editor and player display. Package 7E.4.2 will populate the golf-drill instructions, and Package 7E.4.3 will populate the Vector movement instructions.
