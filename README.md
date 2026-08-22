# Package 7G.1.1 · TrackMan drag-and-drop correction

Upload `app/trackman/page.tsx` to the matching GitHub location and replace the existing file. Commit the change and wait for Vercel to redeploy.

No Supabase SQL is required.

After deployment, drag a `.csv` file over the upload field. The field should highlight, accept the dropped file and display the staging summary. A non-CSV file should be rejected with a clear message. Clicking the field to choose a file continues to work.
