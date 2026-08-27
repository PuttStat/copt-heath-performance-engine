# Vector Golf Performance — Package 7I.1

Secure golf-swing video upload, processing, player library and coach review queue for the existing Next.js App Router + Supabase application.

## Included

- Private, authenticated Mux direct uploads
- Supabase ownership records and Row Level Security
- Verified Mux webhook processing
- Player upload page and personal video library
- Coach pending-review queue using accepted `coach_player_links`
- Retry/error states and audit events

## Installation order

1. Copy the package files into the app, preserving paths.
2. Install `@mux/mux-node` and `@mux/upchunk`.
3. Run `supabase/migrations/202608270001_package_7i_1_swing_videos.sql` in Supabase.
4. Add the environment variables shown in `.env.7i1.example` to local development and Vercel.
5. Add the Mux webhook URL: `https://YOUR-DOMAIN/api/mux/webhook`.
6. Subscribe to `video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`, and `video.upload.cancelled`.
7. Add navigation links to `/player/videos` and `/coach/video-reviews`.
8. Deploy, then complete `PACKAGE_7I_1_VERIFICATION.md`.

The SQL migration is additive. It does not modify round, TrackMan, drill, exercise or coach-note data.
