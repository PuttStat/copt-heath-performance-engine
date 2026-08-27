import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { getMux } from '@/src/lib/mux';

const allowedTypes = new Set(['full_swing','pitching','chipping','bunker','putting']);
const allowedViews = new Set(['down_the_line','face_on','rear','other']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json();
  if (!allowedTypes.has(body.swingType) || !allowedViews.has(body.cameraView)) {
    return NextResponse.json({ error: 'Invalid swing type or camera view' }, { status: 400 });
  }
  if (!body.club || body.fileSize < 1 || body.fileSize > 524288000) {
    return NextResponse.json({ error: 'Choose a valid video no larger than 500 MB' }, { status: 400 });
  }

  const { data: link } = await supabase
    .from('coach_player_links')
    .select('coach_id')
    .eq('player_id', user.id)
    .limit(1)
    .maybeSingle();

  const { data: video, error: insertError } = await supabase
    .from('swing_videos')
    .insert({
      player_id: user.id,
      uploaded_by: user.id,
      assigned_coach_id: link?.coach_id ?? null,
      swing_type: body.swingType,
      camera_view: body.cameraView,
      club: String(body.club).slice(0, 60),
      handedness: body.handedness || null,
      ball_flight: body.ballFlight ? String(body.ballFlight).slice(0, 240) : null,
      player_question: body.playerQuestion ? String(body.playerQuestion).slice(0, 1000) : null,
      original_filename: String(body.fileName || '').slice(0, 255),
      original_size_bytes: body.fileSize,
      original_mime_type: String(body.mimeType || '').slice(0, 100),
      review_requested_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !video) return NextResponse.json({ error: 'Could not create video record' }, { status: 500 });

  try {
    const mux = getMux();
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
      new_asset_settings: {
        passthrough: video.id,
        playback_policies: ['signed'],
        video_quality: 'basic',
      },
    });

    await supabase.from('swing_videos').update({ mux_upload_id: upload.id }).eq('id', video.id);
    return NextResponse.json({ videoId: video.id, uploadUrl: upload.url });
  } catch {
    await supabase.from('swing_videos').update({ status: 'error', mux_error_message: 'Upload could not be started' }).eq('id', video.id);
    return NextResponse.json({ error: 'Upload could not be started' }, { status: 502 });
  }
}
