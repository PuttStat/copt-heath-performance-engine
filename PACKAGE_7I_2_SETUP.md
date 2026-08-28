# Package 7I.2 — Swing Studio

Built on the working 7I.1 recovery version (`31b4c2f`, Recover and reconcile Mux video assets). This adds the review workspace; it does not replace your upload or webhook implementation.

## What is included

- An **Open analysis** button on ready videos in the player library and coach review queue.
- Private signed HLS playback, native HLS on Safari and hls.js on supported other browsers.
- 0.1×, 0.25×, 0.5× and 1× playback; previous/next time-based frame steps; full timeline; a fine scrubber covering one second either side of a chosen moment; A–B loops.
- Lines, arrows, ellipses/circles and three-point angle measurements. Select/move, colours, thickness, undo/redo, delete and clear.
- Drawings tied to one moment or visible throughout the video; click their entries to return to that moment.
- Saved drawings and notes, one layer per author. Players and authorised linked coaches can read one another's saved layers but can edit only their own. Saving a layer shares it; these are not private draft notes.
- Optimistic revision checks stop an older browser tab overwriting a newer save.
- Responsive layout and an expanded workspace. Video and drawings share the video's aspect ratio and normalized coordinates.

Important precision limit: this is streamed-video analysis. Frame stepping seeks by time and is approximate for HLS and variable-frame-rate footage. It does not guarantee native 120/240-fps source access, reconstruct discarded frames, or provide frame-accurate reverse decoding. The UI displays the step rate and its source. Your existing Mux upload quality settings are unchanged.

Not included in 7I.2: dual-video comparison, voiceover recording, exported annotated video, automatic swing diagnosis, or original-file frame decoding.

## 1. Put the patch in the project root

Download and unzip `Vector_Golf_Performance_7I_2.zip` on your Mac. Open the extracted folder.

In Codespaces, the project root is **copt-heath-performance-engine**, the top folder in Explorer. It contains `package.json`, `app`, `src` and `supabase`.

Drag `0001-Add-7I.2-swing-analysis-workspace.patch` into that top folder. Do not put it inside `.next`, `app`, or `src`.

Open **Terminal → New Terminal**. The commands below go into that terminal, not into a code file, the chat panel or Supabase. Paste and run each block separately.

```bash
pwd
```

It should end in `/copt-heath-performance-engine`.

```bash
git status --short -- app src public package.json package-lock.json supabase tests
```

If this reports uncommitted changes in those source locations, stop and share the output before applying the patch. Do not discard your work. Changes under `.next` are generated build output and must not be committed with this package.

If there are no source changes, update the branch:

```bash
git pull --ff-only
```

If this fails, stop. Do not force-push, reset, or attempt to resolve unknown conflicts.

Check that the patch fits your current files:

```bash
git apply --check 0001-Add-7I.2-swing-analysis-workspace.patch
```

No output means the check passed. If it prints an error, stop and share that error; do not force the patch or re-upload 7I.1.

Apply it:

```bash
git apply 0001-Add-7I.2-swing-analysis-workspace.patch
```

Then install the dependency version from the included lockfile:

```bash
npm ci
```

## 2. Add the new Supabase table

Use the same Supabase project that contains your two ready videos.

1. Open `supabase/migrations/202608280001_package_7i_2_video_annotations.sql` in Codespaces. The same SQL file is included separately in the downloaded ZIP.
2. Select and copy the entire SQL file, including `begin;` and `commit;`.
3. In Supabase, choose **SQL Editor**, open a **new query**, and paste the SQL contents. Do not paste the filename or terminal commands.
4. Click **Run**. Expect success with no returned rows.
5. In Table Editor, confirm `swing_video_annotations` exists. It will be empty until you save your first drawing.

Run only this new migration. Do not rerun the old 7I.1 migration. The new migration uses your existing `coach_player_links` columns and does not assume a `status` column. It can be run again safely and does not delete videos, drawings or other programme data.

Do not disable row-level security to resolve an error. If it fails, share the error text.

## 3. Create a Mux signing key

These are two NEW values. They are different from the upload API token and webhook signing secret.

1. Open [Mux Signing Keys](https://dashboard.mux.com/settings/signing-keys).
2. Select the **same Mux environment as the uploaded videos**. Your screenshots showed **Development**. A Vercel Production deployment can use that environment for this test; do not switch environments or recreate existing assets as part of this installation.
3. Create a signing key. Copy its **ID** and **private key** securely when Mux shows them. Do not post the private key in chat or put it in GitHub.
4. The private key may be supplied as base64-encoded PEM. Use the complete value Mux gives you; this code accepts base64 PEM or multiline PEM.

Mux documents signing-key creation separately from API tokens in its [Signing JWTs guide](https://www.mux.com/docs/guides/signing-jwts).

## 4. Add those two values to Vercel

Open your Vector Golf Performance project → **Environment Variables** → **Add Environment Variable**.

| Key                       | Value                                         | Type   | Vercel environment |
| ------------------------- | --------------------------------------------- | ------ | ------------------ |
| `MUX_SIGNING_KEY_ID`      | ID of the new Mux signing key                 | Secret | Production         |
| `MUX_SIGNING_PRIVATE_KEY` | Complete private key of that same signing key | Secret | Production         |

Save both. For a preview deployment, also configure its Preview environment deliberately using matching Mux credentials. Do not prefix either variable with `NEXT_PUBLIC_`.

Keep the working existing variables: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL`. Do not replace them with signing keys.

No extra secrets are required merely to compile the new code in Codespaces. The live playback endpoint checks signing configuration when a user opens a video.

## 5. Test the code and deploy

Back in the Codespaces terminal:

```bash
npm run test:video
```

Expect 16 passing tests. Then:

```bash
npm run build
```

Expect a successful build with `/player/videos/[videoId]` and the new `/api/videos/[videoId]/analysis` and `/playback` routes. If either command fails, stop before committing and share the error.

Stage only the package files. This deliberately avoids `.next`, `node_modules` and any credentials. Run the following as one block, preserving the backslashes:

```bash
git add -- package.json package-lock.json public/sw.js \
  app/player/videos/page.tsx app/coach/video-reviews/page.tsx \
  'app/player/videos/[videoId]/page.tsx' \
  'app/api/videos/[videoId]/analysis/route.ts' \
  'app/api/videos/[videoId]/playback/route.ts' \
  src/components/video/AnalysisWorkspace.tsx src/components/video/DrawingOverlay.tsx \
  src/lib/video-analysis.ts src/lib/video-access.ts src/styles/package-7i2.css \
  supabase/migrations/202608280001_package_7i_2_video_annotations.sql \
  tests/video-analysis.test.mjs tests/video-api.test.mjs \
  PACKAGE_7I_2_SETUP.md PACKAGE_7I_2_VERIFICATION.md
```

Inspect what will be committed:

```bash
git diff --cached --stat
```

Expect only the files named above. If you see `.next`, `node_modules`, private keys or unrelated files, stop rather than committing them.

```bash
git commit -m "Add 7I.2 swing analysis workspace"
```

```bash
git push
```

If rejected, stop and share the message. Never use force-push for this installation.

In Vercel, wait for the deployment for **Add 7I.2 swing analysis workspace** to show **Ready**. Because the new variables were added before pushing, that deployment should receive them. If you added the variables afterward, redeploy that same latest commit once.

## 6. Verify one existing video

1. Open [My swing videos](https://app.vectorgolfperformance.co.uk/player/videos) and sign in normally.
2. Refresh the page. If old UI persists, close the app tabs and reopen it so the updated service worker can take control. Do not clear all site data; this app also contains programme data.
3. Click **Open analysis** on one ready video. No re-upload is needed.
4. Confirm the actual golf video plays. Try 0.25×, then pause, Next frame and Previous frame.
5. Use the full slider to reach impact; select **Centre here** and try the fine scrubber. The small slider is a ±1-second window, not an extra video.
6. With the video paused, choose **Line** and drag over it. Choose **Angle** and tap start, vertex, end.
7. Add a note, click **Save drawings & notes**, then reload. Confirm the drawings and note return. Click a saved moment to return to its timestamp.
8. In a second tab, edit the same layer. Save in the first tab, then attempt to save the older second tab. It should report a conflict rather than overwrite the first save.
9. Log in as an authorised linked coach and open [Coach video reviews](https://app.vectorgolfperformance.co.uk/coach/video-reviews). The player's saved layer should be read-only; the coach can create a separate layer.
10. A different, unlinked account must not be able to open the same video URL. Do not treat a working owner account as proof that access control is configured correctly.
11. Test on your actual iPhone/iPad Safari too, especially portrait clips and drawing alignment after rotating the device.

Only call 7I.2 live-verified after these checks. A Ready deployment or successful unit test does not prove live media playback.

## Troubleshooting

| Message or symptom                            | Next check                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Drawings could not be loaded; check migration | Run the new 7I.2 SQL in the correct Supabase project.                                                                               |
| Secure playback needs signing variables       | Check both exact Vercel names, Production scope, then redeploy.                                                                     |
| Stream cannot play                            | Confirm the key ID and private key are a pair from the asset's Mux environment. Do not change videos to public playback.            |
| Asset could not be securely matched           | Stop and inspect reconciliation/asset passthrough. Do not bypass the match or manually copy another playback ID.                    |
| Video not found for a coach                   | Confirm the coach role and existing coach-player link. An unrelated administrator is not given blanket access.                      |
| Another tab saved newer drawings              | Copy any unsaved notes, reload the stale tab, then reapply the intended changes.                                                    |
| Playback expires during a long session        | Use Refresh playback. The drawings remain in the editor. Already issued playback URLs can remain valid until their one-hour expiry. |
| Ready but no Open analysis button             | Verify the latest code commit deployed, then reload/close old app tabs.                                                             |

## Rollback

If the new viewer causes trouble, use Vercel to restore the previous known-good deployment. Keep the additive annotation table and its rows; there is no need to delete data. The package does not remove the original video library, upload endpoint, webhook or reconciliation code. Do not roll back by deleting the repository or rerunning older database migrations.
