# Vector Golf Performance — Package 7E.1

The live, data-driven player performance engine for the selected-player beta of the 12-week Vector Golf Performance programme.

## Included

- Responsive Today dashboard and mobile navigation
- Offline-first Quick Round entry across the ten agreed shot bands
- Explicit distinction between an empty value and a recorded zero
- Local draft persistence and idempotent UUID queue records
- Weighted performance-priority calculation boundary
- Practice prescription and coach-insight views
- Install manifest, icons and offline application shell
- Placeholder routes for detailed hole-by-hole entry and later engine integration
- Invitation-only passwordless sign-in
- Supabase schema, migrations and player-level Row Level Security
- Player/coach relationship model and offline-to-cloud round synchronisation
- Authenticated profile and real round totals on the dashboard
- Frequency × failure × evidence practice-priority calculation
- Full 18-hole shot capture with golfer-defined success/failure
- Short/long and left/right miss-pattern capture for failures
- 224 coded golf-drill routes from the Performance Engine
- 31 initial VECTOR exercises from the completed 2E programming manuals
- Coach-only Library Manager with draft, approval, retirement and version history
- Diagnostic-rule and drill/exercise linking foundation

Follow `PACKAGE_7E1_SETUP.md` to create and seed the library before deploying the updated application.

## Run locally

```bash
npm ci
npm run dev
```

Open the local URL shown in the terminal. For a production check:

```bash
npm run lint
npm test
```

## Supabase environment

Copy `.env.example` to `.env.local` only when Package 7C begins. Never commit `.env.local` or the Supabase service-role key. Client code will use only the project URL and anon/publishable key; row-level security remains the security boundary.

## Suggested delivery order

1. **7B — complete:** PWA shell and offline capture
2. **7C — complete:** Supabase schema, invite-only auth and RLS
3. **7D — complete:** detailed round capture and weighted priority engine
4. **7E.1 — current:** structured drill, exercise and diagnostic-rule libraries
5. **7E.2:** evidence evaluation and recommendation engine
6. **7F:** 12-week prescription and adherence
7. **7G:** TrackMan import and coach tools
8. **7H:** beta QA, analytics and production release
