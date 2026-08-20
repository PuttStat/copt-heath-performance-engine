# Vector Golf Performance — Package 7B

The installable PWA foundation for a selected-player beta of the 12-week Vector Golf Performance programme.

## Included

- Responsive Today dashboard and mobile navigation
- Offline-first Quick Round entry across the ten agreed shot bands
- Explicit distinction between an empty value and a recorded zero
- Local draft persistence and idempotent UUID queue records
- Weighted performance-priority calculation boundary
- Practice prescription and coach-insight views
- Install manifest, icons and offline application shell
- Placeholder routes for detailed hole-by-hole entry and later engine integration

The interface currently uses a demo player and local browser storage. Package 7C will connect the existing Ireland-region Supabase project, implement invite-only authentication and add row-level player isolation.

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

1. **7B — current:** PWA shell and offline capture
2. **7C:** Supabase schema, invite-only auth and RLS
3. **7D:** round capture, sync and calibrated priority engine
4. **7E:** diagnostic rules and drill recommendations
5. **7F:** 12-week prescription and adherence
6. **7G:** TrackMan import and coach tools
7. **7H:** beta QA, analytics and production release
