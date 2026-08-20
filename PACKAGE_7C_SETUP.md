# Package 7C setup

## 1. Create the database structure

In Supabase, open **SQL Editor → New query**. Paste the complete contents of:

`supabase/migrations/202608200001_package_7c.sql`

Select **Run** once. The script creates the player profile, coaching relationship, rounds and shot-band result tables, plus Row Level Security policies.

## 2. Keep access invitation-only

In **Authentication → Providers → Email**, keep email enabled. The application uses email links with `shouldCreateUser: false`, so unknown email addresses cannot create accounts through the app.

Add each beta player through **Authentication → Users → Add user → Send invitation**. Do not add a public sign-up link.

## 3. Add allowed redirect URLs

In **Authentication → URL Configuration**:

- Set the Site URL to the final Vercel production URL.
- Add `http://localhost:3000/auth/callback` for local development.
- Add `https://YOUR-VERCEL-DOMAIN/auth/callback` for production.

## 4. Add Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qyrhloygykgcmbdxhewe.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the supplied `sb_publishable_...` key |

Apply both to Production, Preview and Development. Redeploy after saving them.

Never add a service-role or secret key to browser code, GitHub or these public variables.

## 5. Set the coach account

After inviting and signing in with the coach email, open **Table Editor → profiles**, find that account and change `role` from `player` to `coach`. Coaching relationships can then be inserted into `coach_player_links` using the coach and player profile IDs.

## 6. Test isolation before beta release

Invite two temporary player addresses. Record one round under each account and confirm:

- each player sees only their own records;
- neither player can read or change the other player's data;
- a linked coach can read both players' results;
- an unlinked coach cannot read them;
- a round recorded offline synchronises only once when connection returns.
