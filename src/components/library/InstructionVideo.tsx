type Provider = "youtube" | "vimeo";

export type InstructionVideoDetails = {
  provider: Provider;
  embedUrl: string;
};

export function parseInstructionVideo(url: string | null | undefined): InstructionVideoDetails | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.pathname.startsWith("/shorts/")
        ? parsed.pathname.split("/")[2]
        : parsed.searchParams.get("v");
      return id ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      return id ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` } : null;
    }
  } catch {}
  return null;
}

export function InstructionVideo({ url, title }: { url: string; title: string }) {
  const video = parseInstructionVideo(url);
  if (!video) return null;
  return (
    <div className="instruction-video">
      <iframe
        src={video.embedUrl}
        title={`${title} instruction video`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
