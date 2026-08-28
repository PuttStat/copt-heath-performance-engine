import { NextResponse } from 'next/server';
import { getMux } from '@/src/lib/mux';
import { createAdminClient } from '@/src/lib/supabase/admin';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });


  const mux = getMux();
  let event: any;
  try {
    event = mux.webhooks.unwrap(rawBody, Object.fromEntries(request.headers), secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const admin = createAdminClient();
  let assetData = event.data;
  let passthrough = event.data?.passthrough;
  let uploadId = event.type?.startsWith('video.upload.')
    ? event.data?.id
    : event.data?.upload_id;

  // Asset webhook payloads do not always contain the originating upload ID or
  // passthrough value. Retrieve the full asset so it can be linked back to the
  // swing_videos row created before the upload began.
  if (!passthrough && !uploadId && event.type?.startsWith('video.asset.')) {
    const assetId = event.data?.id ?? event.object?.id;
    if (assetId) {
      try {
        assetData = await mux.video.assets.retrieve(assetId);
        passthrough = assetData.passthrough;
        uploadId = assetData.upload_id;
      } catch {
        return NextResponse.json({ error: 'Mux asset lookup failed' }, { status: 500 });
      }
    }
  }
  let videoId = passthrough as string | undefined;

  if (!videoId && uploadId) {
    const { data, error } = await admin
      .from('swing_videos')
      .select('id')
      .eq('mux_upload_id', uploadId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: 'Video lookup failed' }, { status: 500 });
    }
    videoId = data?.id;
  }
  if (!videoId && (passthrough || uploadId)) {
    return NextResponse.json({ error: 'Video record not found' }, { status: 500 });
  }
  if (!videoId) return NextResponse.json({ received: true, ignored: true });

  if (event.type === 'video.upload.asset_created') {
    await admin.from('swing_videos').update({ status: 'processing', mux_asset_id: event.data.asset_id }).eq('id', videoId);
  } else if (event.type === 'video.asset.ready') {
    const signedPlayback = assetData.playback_ids?.find((p: any) => p.policy === 'signed');
    await admin.from('swing_videos').update({
      status: 'ready',
      mux_asset_id: assetData.id,
      mux_playback_id: signedPlayback?.id ?? null,
      duration_seconds: assetData.duration ?? null,
      aspect_ratio: assetData.aspect_ratio ?? null,
      max_stored_resolution: assetData.max_stored_resolution ?? null,
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
