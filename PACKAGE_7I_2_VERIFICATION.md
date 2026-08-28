# 7I.2 verification and handover

## Scope

New secure single-video review workspace, four annotation tools, slow playback and fine time scrubbing, persisted author layers and notes. The working 7I.1 upload/webhook/recovery logic is retained. Existing videos remain signed; no public playback IDs are created.

## Checks performed in the development workspace

- Production `npm run build`: passed, including TypeScript and the new dynamic page/API routes, without requiring live Mux signing credentials at build time.
- `npm run test:video`: 16 automated tests covering geometry, validation, timestamp bounds, role/link access, authentication failures, stale revisions, server-owned authors, payload limits, missing-table errors, private response headers, asset matching, and the installed Mux SDK's local JWT signing with generated test keys.
- React DOM fixture: line drawing, three-point angle, undo/redo, save/reload, next-frame time movement, moment visibility/bookmark restoration, play/pause state, and read-only shared layers passed. The fixture mocks media playback and backend requests: this is not a real-browser streaming test.
- Temporary PGlite PostgreSQL fixture: the exact new SQL migration applied twice; owner/linked-coach reads passed; unrelated and anonymous reads were denied; direct authenticated writes were denied; removing the link removed read access. This uses a minimal representative schema, not the live Supabase database.
- Patch application checked against the 7I.1 recovery baseline. Generated build output and credentials are excluded from the package.

## Live checks still required

- Add the new table and Mux signing credentials in the intended environments.
- Real authenticated Mux playback and seeking on desktop and iPhone/iPad Safari; portrait drawing alignment and device rotation.
- Actual player/coach/unlinked-account access and save/reload behaviour against your live Supabase policies.
- Confirm a fresh upload still reaches ready and opens in the studio.

The browser-control session was unavailable during this build. No real-browser visual or live Mux playback verification is claimed. The database migration has not been run on production and the package has not been pushed or deployed to your live project.

## Security and operational notes

- Both new endpoints verify the bearer token with Supabase and check ownership or an explicit linked coach/admin relationship. Client-supplied author IDs are not used for saves.
- Playback checks the authoritative Mux asset's passthrough against the video UUID before signing; a changed database playback ID cannot directly obtain a token for a different asset.
- URLs expire after one hour. They are bearer capabilities during their validity, not DRM; access revocation prevents new URLs but cannot instantly revoke one already issued.
- API responses use private/no-store headers. The updated service worker bypasses APIs and bearer-authenticated requests, and retires its two old named shell caches.
- Annotation writes are server-only, validated, size-limited, scoped by author, and revision-checked. Existing broader profile/coaching-link/video policies are not rewritten; review these separately before a wider launch.
- Notes/drawings are shared on explicit Save. Unsaved changes live in memory and can be lost on a crash; the editor warns on ordinary page departure. There is no offline annotation sync or burned-in video export.
- Frame stepping is time-based and approximate for streamed/VFR footage. The implementation does not promise original 120/240-fps access.
