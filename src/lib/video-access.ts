import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { canAccessVideo, isUUID } from "./video-analysis";

export class VideoApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Authorization",
    },
  });
}
export async function videoApi(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof VideoApiError)
      return privateJson({ error: error.message }, error.status);
    // Do not log credentials, signed URLs, request bodies or complete database records.
    console.error(
      "Video analysis request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return privateJson(
      {
        error:
          "Video analysis is unavailable. Check the server configuration and try again.",
      },
      500,
    );
  }
}
export async function requireVideoAccess(request: Request, videoId: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new VideoApiError(401, "Please sign in to open this video.");
  if (!isUUID(videoId)) throw new VideoApiError(404, "Video not found.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new VideoApiError(503, "Video authentication is not configured.");
  const auth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await auth.auth.getUser(authorization.slice(7));
  if (error || !user)
    throw new VideoApiError(
      401,
      "Your session has expired. Please sign in again.",
    );
  const admin = createAdminClient();
  const { data: video, error: videoError } = await admin
    .from("swing_videos")
    .select(
      "id,player_id,title,club,camera_view,swing_type,status,player_question,mux_asset_id,mux_playback_id,duration_seconds,aspect_ratio",
    )
    .eq("id", videoId)
    .maybeSingle();
  if (videoError)
    throw new VideoApiError(503, "The video database is unavailable.");
  if (!video || video.status === "archived")
    throw new VideoApiError(404, "Video not found.");
  let role = "player",
    linked = false;
  if (video.player_id !== user.id) {
    const [profile, link] = await Promise.all([
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      admin
        .from("coach_player_links")
        .select("coach_id")
        .eq("coach_id", user.id)
        .eq("player_id", video.player_id)
        .maybeSingle(),
    ]);
    if (profile.error || link.error)
      throw new VideoApiError(503, "Video access could not be checked.");
    role = profile.data?.role ?? "player";
    linked = !!link.data;
  }
  if (!canAccessVideo(user.id, video.player_id, role, linked))
    throw new VideoApiError(404, "Video not found.");
  return { admin, user, video };
}
