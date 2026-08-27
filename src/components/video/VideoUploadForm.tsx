'use client';

import { FormEvent, useState } from 'react';
import * as UpChunk from '@mux/upchunk';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function VideoUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage('Choose a swing video first.');
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (!session) {
        setBusy(false);
        setMessage('Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch('/api/videos/uploads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          swingType: form.get('swingType'), cameraView: form.get('cameraView'), club: form.get('club'),
          handedness: form.get('handedness'), ballFlight: form.get('ballFlight'), playerQuestion: form.get('playerQuestion'),
          fileName: file.name, fileSize: file.size, mimeType: file.type,
        }),
      });
      const result = await response.json().catch(() => ({ error: 'The upload service returned an invalid response.' }));
      if (!response.ok) {
        setBusy(false);
        setMessage(result.error || 'Upload could not be started.');
        return;
      }

      setMessage('Uploading. Keep this page open until it completes.');
      const upload = UpChunk.createUpload({ endpoint: result.uploadUrl, file, chunkSize: 5120 });
      setBusy(false);
      upload.on('progress', (event: any) => setProgress(Math.round(event.detail)));
      upload.on('success', () => { setProgress(100); setMessage('Upload complete. Vector is preparing the video for review.'); });
      upload.on('error', () => { setMessage('The connection was interrupted. Please try the upload again.'); setBusy(false); });
    } catch {
      setBusy(false);
      setMessage('Upload could not be started. Please refresh the page and try again.');
    }
  }

  if (progress !== undefined && file) return <section className="video-card"><h2>Uploading {file.name}</h2><progress max="100" value={progress}>{progress}%</progress><p>{progress}%</p><p aria-live="polite">{message}</p></section>;

  return (
    <form onSubmit={begin} className="video-upload-form">
      <label>Swing type<select name="swingType" required><option value="full_swing">Full swing</option><option value="pitching">Pitching</option><option value="chipping">Chipping</option><option value="bunker">Bunker</option><option value="putting">Putting</option></select></label>
      <label>Camera view<select name="cameraView" required><option value="down_the_line">Down the line</option><option value="face_on">Face on</option><option value="rear">Rear</option><option value="other">Other</option></select></label>
      <label>Club<input name="club" required maxLength={60} /></label>
      <label>Handedness<select name="handedness"><option value="right">Right handed</option><option value="left">Left handed</option></select></label>
      <label>Ball flight<input name="ballFlight" maxLength={240} /></label>
      <label>What would you like help with?<textarea name="playerQuestion" maxLength={1000} rows={4} /></label>
      <label>Video<input type="file" accept="video/mp4,video/quicktime,video/*" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <p>Maximum 500 MB. Keep high-frame-rate slow-motion footage in its original format.</p>
      <button disabled={busy}>{busy ? 'Preparing upload…' : 'Upload swing'}</button>
      <p role="status">{message}</p>
    </form>
  );
}
