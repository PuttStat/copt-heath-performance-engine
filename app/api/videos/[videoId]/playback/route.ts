import { getMux } from "@/src/lib/mux";
import {
  privateJson,
  requireVideoAccess,
  videoApi,
  VideoApiError,
} from "@/src/lib/video-access";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  return videoApi(async () => {
    const { video } = await requireVideoAccess(
      request,
      (await context.params).videoId,
    );
    if (video.status !== "ready" || !video.mux_asset_id)
      throw new VideoApiError(409, "This video is not ready for playback yet.");
    const keyId = process.env.MUX_SIGNING_KEY_ID,
      keySecret = process.env.MUX_SIGNING_PRIVATE_KEY;
    if (!keyId || !keySecret)
      throw new VideoApiError(
        503,
        "Secure playback needs MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY in Vercel.",
      );
    const mux = getMux();
    const asset = await mux.video.assets.retrieve(video.mux_asset_id);
    // Asset ownership must come from Mux, not a player-editable database playback ID.
    if (asset.passthrough !== video.id)
      throw new VideoApiError(
        409,
        "The video asset could not be securely matched. Ask your administrator to reconcile this upload.",
      );
    const playback = asset.playback_ids?.find(
      (item) => item.policy === "signed",
    );
    if (asset.status !== "ready" || !playback)
      throw new VideoApiError(
        409,
        "Signed playback is not available for this asset.",
      );
    const token = await mux.jwt.signPlaybackId(playback.id, {
      keyId,
      keySecret: keySecret.replace(/\\n/g, "\n"),
      type: "video",
      expiration: "1h",
    });
    return privateJson({
      url: `https://stream.mux.com/${playback.id}.m3u8?token=${token}`,
      expiresAt: Date.now() + 3600000,
      fps: asset.max_stored_frame_rate ?? null,
      duration: asset.duration ?? null,
    });
  });
}
