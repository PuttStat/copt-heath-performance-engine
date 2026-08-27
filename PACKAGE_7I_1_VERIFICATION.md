# Package 7I.1 verification

## Database

- [ ] Migration completes once with no errors.
- [ ] `swing_videos` and `video_audit_events` have RLS enabled.
- [ ] Player A cannot select Player B's video record.
- [ ] An accepted linked coach can see the player's record.
- [ ] An unlinked coach cannot see the record.

## Upload

- [ ] MP4 upload completes on desktop.
- [ ] iPhone MOV upload completes on mobile data or Wi-Fi.
- [ ] File above 500 MB is rejected before an upload URL is issued.
- [ ] Cancelling or losing connection produces a recoverable state.
- [ ] Browser never receives Mux or Supabase server secrets.

## Processing

- [ ] Mux webhook signature is rejected when invalid.
- [ ] `asset_created` moves the video to `processing`.
- [ ] `asset.ready` saves a signed playback ID and moves it to `ready`.
- [ ] Processing failure moves the video to `error` without exposing provider details.
- [ ] Duplicate webhook delivery does not create duplicate video rows.

## User journeys

- [ ] Player sees only their own library at `/player/videos`.
- [ ] Player can upload at `/player/videos/upload`.
- [ ] Coach sees linked-player items at `/coach/video-reviews`.
- [ ] Empty, processing, ready and error states display clearly on mobile.

## Required integration adjustments

- Confirm the existing profile display-name column. Change `full_name` in the coach query if the app uses another name.
- Confirm the existing `coach_player_links.status` value is exactly `accepted`.
- Import `src/styles/package-7i1.css` from the existing global stylesheet or root layout.
- Add the two routes to the existing role-aware navigation.
