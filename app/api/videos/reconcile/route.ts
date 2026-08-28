import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMux } from '@/src/lib/mux';
import { createAdminClient } from '@/src/lib/supabase/admin';

const recoverableStatuses = ['waiting_for_upload', 'uploading', 'processing'];

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!authHeader?.startsWith('Bearer ') || !url || !key) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const accessToken = authHeader.slice('Bearer '.length);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: videos, error: queryError } = await admin
    .from('swing_videos')
    .select('id,mux_upload_id')
    .eq('player_id', user.id)
    .in('status', recoverableStatuses)
    .not('mux_upload_id', 'is', null);

  if (queryError) {
    return NextResponse.json({ error: 'Videos could not be checked' }, { status: 500 });
  }

  const mux = getMux();
  let reconciled = 0;

  for (const video of videos ?? []) {
    try {
      const upload = await mux.video.uploads.retrieve(video.mux_upload_id);
      if (!upload.asset_id) continue;

      const asset = await mux.video.assets.retrieve(upload.asset_id);
      const signedPlayback = asset.playback_ids?.find((playback) => playback.policy === 'signed');
      const status = asset.status === 'ready'
        ? 'ready'
        : asset.status === 'errored'
          ? 'error'
          : 'processing';

      const { error: updateError } = await admin
        .from('swing_videos')
        .update({
          status,
          mux_asset_id: asset.id,
          mux_playback_id: signedPlayback?.id ?? null,
          duration_seconds: asset.duration ?? null,
          aspect_ratio: asset.aspect_ratio ?? null,
          max_stored_resolution: asset.max_stored_resolution ?? null,
          mux_error_message: status === 'error' ? 'Video processing failed' : null,
        })
        .eq('id', video.id)
        .eq('player_id', user.id);

      if (!updateError) reconciled += 1;
    } catch {
      // Leave this record recoverable so a later page visit can try again.
    }
  }

  return NextResponse.json({ reconciled });
}
