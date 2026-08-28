# Vector Golf Performance — 7I.2.1

Drawings, shared feedback, zoom and video navigation.

Apply this update after the working 7I.2 package. It does not replace 7I.1 or 7I.2 and needs no new SQL migration, dependencies or environment variables. Existing saved reviews remain intact. Nothing has been pushed to your live site by this package.

## What changes

- Opening an analysis seeks to the first saved drawing in your layer. If you have no drawings, it opens another saved drawing layer when one exists.
- Selecting another person's drawing layer jumps to its first saved drawing. Saved-moment buttons still reopen individual moments.
- New drawings default to “Throughout the video”. You can still choose “At this moment only”. Existing moment drawings keep their original scope; no saved data is rewritten.
- Your editable notes remain separate from the clearly labelled, read-only player/coach feedback displayed below them. You can save your own notes even while viewing someone else's drawings.
- “Refresh shared reviews” retrieves other people's latest saved feedback without replacing your own unsaved edits. Refresh is manual; this is not live collaborative editing.
- Zoom from 1× to 4×; use the horizontal and vertical sliders to centre the golfer, or Reset zoom. The video and drawings share one transform, so drawings remain attached to the same positions. Zoom does not increase the source video's detail. Zoom is a viewing preference and is not saved with the review.
- Dashboard desktop/mobile menus include My videos and Upload a swing. Coaches/admins also receive Video reviews. Video pages link back to the dashboard.
- A new service-worker cache version helps existing installations pick up the updated interface.

## Installation in Codespaces

Run each command separately. If any command reports an error, stop and share the message. Do not force-push, rerun the old patch, or use `git add .`.

1. Download and unzip this package on your Mac.
2. Upload `0001-Fix-7I.2-reviews-zoom-navigation.patch` to the Codespaces project root: the folder containing `package.json`. Do not put it inside `.next`, `app`, or `src`.
3. Open the Codespaces Terminal. Check for outstanding source edits:

```bash
git status --short -- app src public tests package.json package-lock.json
```

If source changes are listed, stop before applying the patch. Existing `.next` build changes and downloaded untracked patch files are not part of this update; leave them alone.

4. Download the latest committed changes:

```bash
git pull --ff-only
```

If Git says branches have diverged, stop and send the output rather than force-pushing.

5. Check the patch:

```bash
git apply --check 0001-Fix-7I.2-reviews-zoom-navigation.patch
```

No output means the check passed. Then apply it once:

```bash
git apply 0001-Fix-7I.2-reviews-zoom-navigation.patch
```

6. Test and build (existing 7I.2 dependencies must already be installed):

```bash
npm run test:video
```

Expected: 19 tests pass.

```bash
npm run build
```

Expected: a completed route list with no build errors.

7. Stage ONLY the update's source, tests and instructions. Paste this whole command:

```bash
git add app/ui/app-shell.tsx app/player/videos/page.tsx app/player/videos/upload/page.tsx app/coach/video-reviews/page.tsx 'app/api/videos/[videoId]/analysis/route.ts' src/components/video/AnalysisWorkspace.tsx src/components/video/VideoNavigation.tsx src/lib/video-analysis.ts src/styles/package-7i2.css public/sw.js tests/video-analysis.test.mjs tests/video-api.test.mjs PACKAGE_7I_2_1_SETUP.md
```

Check what will be committed:

```bash
git diff --cached --stat
```

Expected: 13 files, none under `.next` or `node_modules`, and no secrets. Stop if other files appear.

8. Commit and push:

```bash
git commit -m "Fix video reviews, shared notes, zoom and navigation"
```

```bash
git push origin main
```

If the push is rejected, keep your commit and send the output. Do not force-push.

9. In Vercel, wait for this commit's production deployment to show Ready. Reload the site. If the old controls remain, close all open Vector tabs and reopen the site so the updated service worker can take control.

## Test on the deployed site

1. Sign in as a player, use My videos, and open an existing saved review. It should show a saved drawing at its recorded time (if any were saved).
2. Look at “Saved drawings” and “Saved moments”. If the count is zero, that layer contains no persisted drawings; this update cannot recover drawings that were never saved. Choose another layer or create a drawing and press Save drawings & notes.
3. Make a whole-video line and a moment-only angle at a later time. Write a note, save, leave, then reopen. Check both drawings with their saved-moment buttons.
4. Sign in as the linked coach. The player's note should appear under Player & coach feedback. Use View saved drawings to see the player's layer. Drawings belonging to another author stay read-only.
5. Add your own coach drawings and note, save, then return as the player. Reopen the analysis or press Refresh shared reviews; confirm the coach's feedback is visible.
6. Set zoom to 2× or 4× and move the golfer into view. Draw a line, reset zoom, save and reload; it should remain attached to the same video coordinates. Test portrait and landscape clips on the devices you use.
7. Check the desktop and mobile dashboard menus. Player: My videos / Upload a swing. Coach: also Video reviews.

## Verification performed before delivery

- All 19 automated geometry, validation, access, API persistence and signing tests passed.
- Production Next.js build passed.
- React DOM simulation passed for saved moment reopening, shared notes in both directions, saving only your own notes while viewing another layer, zoom coordinate conversion, save/reload, and refreshing shared reviews without losing unsaved edits. Video media and backend were mocked in this test.
- The patch is checked against the previously delivered 7I.2 source baseline.
- Live Safari/mobile rendering, real signed Mux playback and your production database remain deployment checks; they were not exercised from this workspace.

The inspected 7I.2 code already saved notes and shapes together. Its default frame-only drawings and hidden shared-layer notes can make saved content look missing. This update addresses those display paths; a zero drawing count after a successful save would need separate investigation using the affected review's API response, without sharing credentials.
