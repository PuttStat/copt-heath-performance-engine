import { NextResponse } from 'next/server';
import { mux } from '@/lib/mux';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });

  let event: any;
  try {
    event = mux.webhooks.unwrap(rawBody, Object.fromEntries(request.headers), secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const admin = createAdminClient();
  const passthrough = event.data?.passthrough;
  const uploadId = event.data?.id;
  let videoId = passthrough as string | undefined;

  if (!videoId && uploadId) {
    const { data } = await admin.from('swing_videos').select('id').eq('mux_upload_id', uploadId).maybeSingle();
    videoId = data?.id;
  }
  if (!videoId) return NextResponse.json({ received: true });

  if (event.type === 'video.upload.asset_created') {
    await admin.from('swing_videos').update({ status: 'processing', mux_asset_id: event.data.asset_id }).eq('id', videoId);
  } else if (event.type === 'video.asset.ready') {
    const signedPlayback = event.data.playback_ids?.find((p: any) => p.policy === 'signed');
    await admin.from('swing_videos').update({
      status: 'ready',
      mux_asset_id: event.data.id,
      mux_playback_id: signedPlayback?.id ?? null,
      duration_seconds: event.data.duration ?? null,
      aspect_ratio: event.data.aspect_ratio ?? null,
      max_stored_resolution: event.data.max_stored_resolution ?? null,
      mux_error_message: null,
    }).eq('id', videoId);
  } else if (event.type === 'video.asset.errored') {
    await admin.from('swing_videos').update({ status: 'error', mux_error_message: 'Video processing failed' }).eq('id', videoId);
  } else if (event.type === 'video.upload.cancelled') {
    await admin.from('swing_videos').update({ status: 'cancelled' }).eq('id', videoId);
  }

  await admin.from('video_audit_events').insert({ video_id: videoId, actor_id: null, event_type: event.type, detail: { mux_event_id: event.id } });
  return NextResponse.json({ received: true });
}
