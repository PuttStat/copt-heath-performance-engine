import {
  privateJson,
  requireVideoAccess,
  videoApi,
  VideoApiError,
} from "@/src/lib/video-access";
import { validateDocument } from "@/src/lib/video-analysis";
export const runtime = "nodejs";
type Context = { params: Promise<{ videoId: string }> };

export async function GET(request: Request, context: Context) {
  return videoApi(async () => {
    const { admin, user, video } = await requireVideoAccess(
      request,
      (await context.params).videoId,
    );
    const { data, error } = await admin
      .from("swing_video_annotations")
      .select("author_id,revision,document,updated_at")
      .eq("video_id", video.id)
      .order("updated_at");
    if (error)
      throw new VideoApiError(
        503,
        "Drawings could not be loaded. Check that the 7I.2 Supabase migration has been run.",
      );
    return privateJson({
      userId: user.id,
      video: {
        id: video.id,
        title: video.title,
        club: video.club,
        camera_view: video.camera_view,
        swing_type: video.swing_type,
        status: video.status,
        player_question: video.player_question,
        duration: Number(video.duration_seconds) || null,
        aspect_ratio: video.aspect_ratio,
        isOwner: user.id === video.player_id,
      },
      annotations: data,
    });
  });
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new VideoApiError(400, "Missing drawings.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 100000) {
        await reader.cancel();
        throw new VideoApiError(413, "Drawing document is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new VideoApiError(400, "Invalid drawing document.");
  }
}
export async function PUT(request: Request, context: Context) {
  return videoApi(async () => {
    const { admin, user, video } = await requireVideoAccess(
      request,
      (await context.params).videoId,
    );
    const body = await readBody(request);
    const duration = Number(video.duration_seconds);
    if (
      !body ||
      !Number.isInteger(body.revision) ||
      body.revision < 0 ||
      body.revision > 2147483645 ||
      !validateDocument(
        body.document,
        Number.isFinite(duration) && duration > 0 ? duration : 86400,
      )
    )
      throw new VideoApiError(400, "Invalid drawings, notes or revision.");
    // The author always comes from the verified session, never from the request body.
    const values = {
      document: body.document,
      revision: body.revision + 1,
      updated_at: new Date().toISOString(),
    };
    const query =
      body.revision === 0
        ? admin
            .from("swing_video_annotations")
            .insert({ ...values, video_id: video.id, author_id: user.id })
        : admin
            .from("swing_video_annotations")
            .update(values)
            .eq("video_id", video.id)
            .eq("author_id", user.id)
            .eq("revision", body.revision);
    const { data, error } = await query
      .select("author_id,revision,document,updated_at")
      .maybeSingle();
    if (error?.code === "23505" || (!error && !data))
      throw new VideoApiError(
        409,
        "Another tab saved newer drawings. Copy your notes, then reload before editing again.",
      );
    if (error)
      throw new VideoApiError(
        503,
        "Drawings could not be saved. Your changes are still on this page.",
      );
    return privateJson(data);
  });
}
