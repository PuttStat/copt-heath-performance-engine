"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Hls from "hls.js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DrawingOverlay } from "./DrawingOverlay";
import {
  DRAWING_COLORS,
  DRAWING_TOOLS,
  clamp,
  drawingVisible,
  emptyDocument,
  formatTime,
  stepTime,
  firstDrawingTime,
  zoomTransform,
  type AnalysisDocument,
  type AnnotationSet,
  type Drawing,
  type DrawingTool,
} from "@/src/lib/video-analysis";
type VideoInfo = {
  id: string;
  title: string | null;
  club: string;
  camera_view: string;
  swing_type: string;
  status: string;
  player_question: string | null;
  duration: number | null;
  aspect_ratio: string | null;
  isOwner: boolean;
};
type AnalysisResponse = {
  userId: string;
  video: VideoInfo;
  annotations: AnnotationSet[];
};
type Playback = {
  url: string;
  expiresAt: number;
  fps: number | null;
  duration: number | null;
};
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Video authentication is not configured.");
  let authTimer: number | undefined;
  const {
    data: { session },
  } = await Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_resolve, reject) => {
      authTimer = window.setTimeout(
        () =>
          reject(
            new Error("Sign-in is taking too long. Reload and sign in again."),
          ),
        15000,
      );
    }),
  ]).finally(() => window.clearTimeout(authTimer));
  if (!session) throw new Error("Please sign in again to continue.");
  const controller = new AbortController(),
    timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error || "The request failed. Please try again.");
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
export function AnalysisWorkspace({ videoId }: { videoId: string }) {
  const [info, setInfo] = useState<AnalysisResponse | null>(null),
    [loadError, setLoadError] = useState("");
  const [playback, setPlayback] = useState<Playback | null>(null),
    [playbackError, setPlaybackError] = useState("");
  const [mediaReady, setMediaReady] = useState(false),
    [requestingPlayback, setRequestingPlayback] = useState(false);
  const [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [aspect, setAspect] = useState(16 / 9);
  const [fps, setFps] = useState(30),
    [fpsSource, setFpsSource] = useState("estimate"),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(0.25);
  const [fineAnchor, setFineAnchor] = useState(0),
    [loopStart, setLoopStart] = useState<number | null>(null),
    [loopEnd, setLoopEnd] = useState<number | null>(null),
    [loop, setLoop] = useState(false),
    [expanded, setExpanded] = useState(false);
  const [tool, setTool] = useState<DrawingTool | "select">("select"),
    [color, setColor] = useState<string>(DRAWING_COLORS[0]),
    [width, setWidth] = useState(3),
    [scope, setScope] = useState<"frame" | "video">("video");
  const [selected, setSelected] = useState<string | null>(null),
    [layer, setLayer] = useState("mine"),
    [showDrawing, setShowDrawing] = useState(true);
  const [zoom, setZoom] = useState(1),
    [panX, setPanX] = useState(0),
    [panY, setPanY] = useState(0),
    [refreshingReviews, setRefreshingReviews] = useState(false);
  const [doc, setDoc] = useState<AnalysisDocument>(emptyDocument),
    [past, setPast] = useState<AnalysisDocument[]>([]),
    [future, setFuture] = useState<AnalysisDocument[]>([]);
  const [revision, setRevision] = useState(0),
    [saved, setSaved] = useState(JSON.stringify(emptyDocument())),
    [saving, setSaving] = useState(false),
    [saveMessage, setSaveMessage] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    restoreTime = useRef(0);
  const dirty = JSON.stringify(doc) !== saved,
    readOnly = layer !== "mine";
  useEffect(() => {
    let active = true;
    api<AnalysisResponse>(`/api/videos/${videoId}/analysis`)
      .then((data) => {
        if (!active) return;
        setInfo(data);
        const mine = data.annotations.find((s) => s.author_id === data.userId),
          initial = mine?.document ?? emptyDocument();
        setDoc(initial);
        setSaved(JSON.stringify(initial));
        setRevision(mine?.revision ?? 0);
        const opening = mine?.document.shapes.length
          ? mine
          : data.annotations.find((s) => s.document.shapes.length);
        if (opening) {
          setLayer(opening.author_id === data.userId ? "mine" : opening.author_id);
          restoreTime.current = firstDrawingTime(opening.document);
        }
      })
      .catch((error) => {
        if (active) setLoadError(message(error));
      });
    return () => {
      active = false;
    };
  }, [videoId]);
  async function refreshReviews() {
    setRefreshingReviews(true);
    try {
      const data = await api<AnalysisResponse>(`/api/videos/${videoId}/analysis`);
      // Never replace the current user's unsaved document or revision.
      setInfo(data);
      setSaveMessage("Shared reviews refreshed. Your own edits are unchanged.");
    } catch (error) {
      setSaveMessage(message(error));
    } finally {
      setRefreshingReviews(false);
    }
  }
  function openLayer(value: string) {
    const document = value === "mine" ? doc
      : info?.annotations.find((s) => s.author_id === value)?.document;
    setLayer(value);
    setTool("select");
    setSelected(null);
    setShowDrawing(true);
    if (document?.shapes.length) {
      restoreTime.current = firstDrawingTime(document);
      seek(restoreTime.current, true);
    }
  }
  const refreshPlayback = useCallback(async () => {
    setRequestingPlayback(true);
    setPlaybackError("");
    if (video.current && video.current.readyState >= 1)
      restoreTime.current = video.current.currentTime;
    try {
      setPlayback(
        await api<Playback>(`/api/videos/${videoId}/playback`, {
          method: "POST",
        }),
      );
    } catch (error) {
      setPlaybackError(message(error));
    } finally {
      setRequestingPlayback(false);
    }
  }, [videoId]);
  useEffect(() => {
    if (info?.video.status === "ready") void refreshPlayback();
  }, [info?.video.status, refreshPlayback]);
  useEffect(() => {
    const media = video.current;
    if (!media || !playback) return;
    setMediaReady(false);
    setPlaying(false);
    setFps(playback.fps && playback.fps > 0 ? playback.fps : 30);
    setFpsSource(playback.fps ? "Mux maximum" : "estimate");
    let hls: Hls | null = null;
    const loaded = () => {
      if (Number.isFinite(media.duration)) setDuration(media.duration);
      if (media.videoWidth && media.videoHeight)
        setAspect(media.videoWidth / media.videoHeight);
      media.currentTime = Math.min(restoreTime.current, media.duration || 0);
      setTime(media.currentTime);
      setFineAnchor(media.currentTime);
      setMediaReady(true);
    };
    media.addEventListener("loadedmetadata", loaded);
    if (media.canPlayType("application/vnd.apple.mpegurl"))
      media.src = playback.url;
    else if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30 });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal)
          setPlaybackError(
            "Playback could not load. Check your connection or refresh secure playback.",
          );
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const frameRate = hls?.levels[data.level]?.frameRate;
        if (frameRate) {
          setFps(frameRate);
          setFpsSource("stream");
        }
      });
      hls.loadSource(playback.url);
      hls.attachMedia(media);
    } else
      setPlaybackError(
        "This browser does not support this video stream. Use Safari, Chrome, Firefox or Edge.",
      );
    return () => {
      media.pause();
      media.removeEventListener("loadedmetadata", loaded);
      hls?.destroy();
      media.removeAttribute("src");
      media.load();
    };
  }, [playback]);
  useEffect(() => {
    if (!playback) return;
    const timer = window.setTimeout(
      () => {
        video.current?.pause();
        setPlaybackError(
          "Your secure playback link has expired. Refresh playback to continue; your drawings are unchanged.",
        );
      },
      Math.max(0, playback.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [playback]);
  useEffect(() => {
    const media = video.current;
    if (!media) return;
    let id = 0;
    const tick = () => {
      setTime(media.currentTime);
      if (
        loop &&
        loopStart !== null &&
        loopEnd !== null &&
        media.currentTime >= loopEnd
      )
        media.currentTime = loopStart;
      if (!media.paused) id = window.requestAnimationFrame(tick);
    };
    if (playing) id = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(id);
  }, [playing, loop, loopStart, loopEnd]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(next: AnalysisDocument) {
    setPast((history) => [...history.slice(-49), doc]);
    setDoc(next);
    setFuture([]);
    setSaveMessage("");
  }
  function undo() {
    if (!past.length) return;
    setFuture((history) => [doc, ...history]);
    setDoc(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setSelected(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((history) => [...history, doc]);
    setDoc(future[0]);
    setFuture(future.slice(1));
    setSelected(null);
  }
  async function save() {
    if (saving) return;
    const snapshot = doc;
    setSaving(true);
    setSaveMessage("");
    try {
      const result = await api<AnnotationSet>(
        `/api/videos/${videoId}/analysis`,
        {
          method: "PUT",
          body: JSON.stringify({ document: snapshot, revision }),
        },
      );
      setRevision(result.revision);
      setSaved(JSON.stringify(snapshot));
      setSaveMessage("Saved. Shared with the player and authorised coaches.");
    } catch (error) {
      setSaveMessage(message(error));
    } finally {
      setSaving(false);
    }
  }
  function pause() {
    video.current?.pause();
  }
  function seek(target: number, centre = false) {
    const media = video.current;
    if (!media || !mediaReady) return;
    media.pause();
    media.currentTime = clamp(target, 0, duration);
    setTime(media.currentTime);
    if (centre) setFineAnchor(media.currentTime);
    setSelected(null);
  }
  async function togglePlay() {
    const media = video.current;
    if (!media || !mediaReady) return;
    if (!media.paused) {
      media.pause();
      return;
    }
    if (
      loop &&
      loopStart !== null &&
      loopEnd !== null &&
      (media.currentTime < loopStart || media.currentTime >= loopEnd)
    )
      media.currentTime = loopStart;
    try {
      media.playbackRate = rate;
      await media.play();
    } catch {
      setPlaybackError(
        "This playback speed could not start. Try 0.25× or use frame stepping.",
      );
    }
  }
  function setSpeed(value: number) {
    try {
      if (video.current) video.current.playbackRate = value;
      setRate(value);
    } catch {
      setPlaybackError(
        "This browser does not support that speed. Use frame stepping instead.",
      );
    }
  }
  function add(shape: Drawing) {
    if (doc.shapes.length >= 100) {
      setSaveMessage(
        "Maximum 100 drawings per layer. Delete a drawing before adding another.",
      );
      return;
    }
    edit({ ...doc, shapes: [...doc.shapes, shape] });
    setSelected(shape.id);
  }
  function removeSelected() {
    if (selected && !readOnly) {
      edit({ ...doc, shapes: doc.shapes.filter((s) => s.id !== selected) });
      setSelected(null);
    }
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("input,textarea,select,button,a"))
      return;
    if (event.key === " ") {
      event.preventDefault();
      void togglePlay();
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      seek(
        stepTime(
          video.current?.currentTime ?? time,
          (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1),
          fps,
          duration,
        ),
      );
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
    }
    if (event.key === "Escape") {
      setTool("select");
      setSelected(null);
      setExpanded(false);
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z" &&
      !readOnly
    ) {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
    }
  }
  const activeDocument =
    layer === "mine"
      ? doc
      : (info?.annotations.find((s) => s.author_id === layer)?.document ??
        emptyDocument());
  const visible = showDrawing
    ? activeDocument.shapes.filter((s) => drawingVisible(s, time, fps))
    : [];
  const fineMin = Math.max(0, fineAnchor - 1),
    fineMax = Math.min(duration, fineAnchor + 1);
  if (loadError)
    return (
      <main className="swing-studio">
        <div className="swing-notice" role="alert">
          <h1>Video unavailable</h1>
          <p>{loadError}</p>
          <Link href="/player/videos">Back to my videos</Link>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  if (!info)
    return (
      <main className="swing-studio">
        <p role="status">Opening your analysis workspace…</p>
      </main>
    );
  return (
    <main
      className={`swing-studio ${expanded ? "swing-expanded" : ""}`}
      onKeyDown={keyboard}
      tabIndex={0}
      aria-label="Swing analysis workspace"
    >
      <header className="swing-header">
        <div>
          <Link href="/" onClick={(event) => {
            if (dirty && !window.confirm("Leave without saving your drawings and notes?")) event.preventDefault();
          }}>← Dashboard</Link>{" · "}
          <Link
            href={
              info.video.isOwner ? "/player/videos" : "/coach/video-reviews"
            }
            onClick={(event) => {
              if (
                dirty &&
                !window.confirm("Leave without saving your drawing changes?")
              )
                event.preventDefault();
            }}
          >
            ← {info.video.isOwner ? "My swing videos" : "Coach review queue"}
          </Link>
          <p className="swing-eyebrow">VECTOR / SWING STUDIO</p>
          <h1>{info.video.title || `${info.video.club} analysis`}</h1>
          <p>
            {info.video.swing_type.replaceAll("_", " ")} /{" "}
            {info.video.camera_view.replaceAll("_", " ")}
          </p>
        </div>
        <div className="swing-header-actions">
          <span className="swing-save-status" role="status">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button
            className="swing-primary"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : "Save drawings & notes"}
          </button>
        </div>
      </header>
      <div className="swing-workbench">
        <section
          className="swing-player"
          aria-label="Video and playback controls"
        >
          <div className="swing-canvas-area">
            <div
              className="swing-stage"
              style={{
                aspectRatio: aspect,
                width: `min(100%, ${60 * aspect}vh)`,
              }}
            >
              <div className="swing-zoom-content" style={{ transform: zoomTransform(zoom, panX, panY) }}>
              <video
                ref={video}
                playsInline
                muted
                preload="metadata"
                disablePictureInPicture
                onTimeUpdate={() => {
                  if (video.current) setTime(video.current.currentTime);
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  setPlaying(false);
                  if (loop && loopStart !== null) {
                    seek(loopStart);
                    void togglePlay();
                  }
                }}
                onError={() => {
                  if (playback)
                    setPlaybackError(
                      "The stream could not be played. Refresh playback or check the Mux signing key.",
                    );
                }}
              />
              {mediaReady && (
                <DrawingOverlay
                  key={`${tool}-${layer}-${scope}-${playing}-${showDrawing}-${Math.round(time * fps)}`}
                  shapes={visible}
                  tool={tool}
                  color={color}
                  width={width}
                  time={time}
                  scope={scope}
                  aspect={aspect}
                  readOnly={readOnly || !showDrawing || playing}
                  selected={selected}
                  onSelect={setSelected}
                  onAdd={add}
                  onMove={(shape) =>
                    edit({
                      ...doc,
                      shapes: doc.shapes.map((s) =>
                        s.id === shape.id ? shape : s,
                      ),
                    })
                  }
                  onPause={pause}
                />
              )}
              </div>
              {!mediaReady && (
                <div className="swing-loading">
                  <span className="swing-monogram">V</span>
                  <p>
                    {info.video.status !== "ready"
                      ? "This video is still processing."
                      : playbackError
                        ? "Playback needs attention"
                        : "Loading secure video…"}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="swing-zoom-controls" aria-label="Video zoom controls">
            <label>Zoom {zoom.toFixed(1)}×
              <input aria-label="Video zoom" type="range" min="1" max="4" step="0.1"
                value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
            <label>Move left / right
              <input aria-label="Horizontal position" type="range" min="-100" max="100"
                value={panX} disabled={zoom === 1} onChange={(event) => setPanX(Number(event.target.value))} />
            </label>
            <label>Move up / down
              <input aria-label="Vertical position" type="range" min="-100" max="100"
                value={panY} disabled={zoom === 1} onChange={(event) => setPanY(Number(event.target.value))} />
            </label>
            <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}>Reset zoom</button>
          </div>
          {playbackError && (
            <div className="swing-media-error" role="alert">
              {playbackError}
            </div>
          )}
          <div className="swing-playback-toolbar">
            <span className="swing-clock">
              {formatTime(time)} <span>/ {formatTime(duration)}</span>
            </span>
            <button
              onClick={() => void refreshPlayback()}
              disabled={requestingPlayback}
            >
              {requestingPlayback ? "Connecting…" : "Refresh playback"}
            </button>
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? "Exit expanded view" : "Expand workspace"}
            </button>
          </div>
          <div className="swing-timeline">
            <label htmlFor="swing-timeline">Full video</label>
            <input
              id="swing-timeline"
              aria-label="Full video scrubber"
              type="range"
              min="0"
              max={duration || 1}
              step="0.001"
              value={time}
              disabled={!mediaReady}
              onChange={(event) => seek(Number(event.target.value), true)}
            />
            <div className="swing-transport">
              <button
                disabled={!mediaReady}
                onClick={() => seek(0, true)}
                aria-label="Return to start"
              >
                ↤ Start
              </button>
              <button
                disabled={!mediaReady}
                onClick={() =>
                  seek(
                    stepTime(
                      video.current?.currentTime ?? time,
                      -1,
                      fps,
                      duration,
                    ),
                  )
                }
                aria-label="Previous frame"
              >
                ‹ Frame
              </button>
              <button
                className="swing-play"
                disabled={!mediaReady}
                onClick={() => void togglePlay()}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                disabled={!mediaReady}
                onClick={() =>
                  seek(
                    stepTime(
                      video.current?.currentTime ?? time,
                      1,
                      fps,
                      duration,
                    ),
                  )
                }
                aria-label="Next frame"
              >
                Frame ›
              </button>
              <label>
                Speed
                <select
                  aria-label="Playback speed"
                  value={rate}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                >
                  {[0.1, 0.25, 0.5, 1].map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="swing-fine-heading">
              <label htmlFor="swing-fine">
                Fine scrub · {formatTime(fineMin)}–{formatTime(fineMax)}
              </label>
              <button
                disabled={!mediaReady}
                onClick={() => setFineAnchor(time)}
              >
                Centre here
              </button>
            </div>
            <input
              id="swing-fine"
              aria-label="Fine video scrubber"
              type="range"
              min={fineMin}
              max={fineMax || 1}
              step="0.001"
              value={clamp(time, fineMin, fineMax)}
              disabled={!mediaReady}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <div className="swing-loop">
              <button
                disabled={!mediaReady}
                onClick={() => {
                  setLoopStart(time);
                  setLoop(false);
                }}
              >
                Set loop start
              </button>
              <button
                disabled={!mediaReady}
                onClick={() => {
                  setLoopEnd(time);
                  setLoop(false);
                }}
              >
                Set loop end
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={loop}
                  disabled={
                    loopStart === null ||
                    loopEnd === null ||
                    loopEnd <= loopStart
                  }
                  onChange={(event) => setLoop(event.target.checked)}
                />{" "}
                Loop
              </label>
              <span>
                {loopStart === null ? "—" : formatTime(loopStart)} →{" "}
                {loopEnd === null ? "—" : formatTime(loopEnd)}
              </span>
            </div>
            <details className="swing-precision">
              <summary>Frame stepping & keyboard shortcuts</summary>
              <label>
                Step rate (frames per second)
                <input
                  aria-label="Frame step rate"
                  type="number"
                  min="1"
                  max="240"
                  step="0.001"
                  value={fps}
                  onChange={(event) => {
                    setFps(clamp(Number(event.target.value) || 30, 1, 240));
                    setFpsSource("manual");
                  }}
                />
              </label>
              <p>
                {fps.toFixed(3).replace(/\.?0+$/, "")} fps · {fpsSource}.
                Time-based frame steps are approximate on streamed or
                variable-frame-rate footage. Slow playback does not restore
                frames absent from the delivered video.
              </p>
              <p>
                Focus this workspace: Space to play/pause; ←/→ to step;
                Shift+←/→ for 10 steps; Delete to remove a selected drawing;
                Cmd/Ctrl+Z to undo; Escape to exit expanded view.
              </p>
            </details>
          </div>
        </section>
        <aside className="swing-inspector" aria-label="Drawing tools and notes">
          <div className="swing-panel-title">
            <h2>Drawing desk</h2>
            <span>7I.2.1</span>
          </div>
          <label className="swing-field">
            Drawings to view
            <select
              value={layer}
              onChange={(event) => openLayer(event.target.value)}
            >
              <option value="mine">My drawings & notes</option>
              {info.annotations
                .filter((s) => s.author_id !== info.userId)
                .map((s, i) => (
                  <option key={s.author_id} value={s.author_id}>
                    {s.author_label || `Shared review ${i + 1}`} · {s.document.shapes.length} drawings · read-only
                  </option>
                ))}
            </select>
          </label>
          <button disabled={refreshingReviews} onClick={() => void refreshReviews()}>
            {refreshingReviews ? "Refreshing reviews…" : "Refresh shared reviews"}
          </button>
          <p className="swing-hint">Saved drawings: {activeDocument.shapes.length}. Moment drawings appear only at their saved time. Choose a saved moment below to reopen it.</p>
          <label className="swing-checkbox">
            <input
              type="checkbox"
              checked={showDrawing}
              onChange={(event) => setShowDrawing(event.target.checked)}
            />{" "}
            Show drawings
          </label>
          <div className="swing-tools" role="group" aria-label="Drawing tools">
            {(["select", ...DRAWING_TOOLS] as const).map((name) => (
              <button
                key={name}
                aria-pressed={tool === name}
                disabled={readOnly || !mediaReady}
                onClick={() => {
                  pause();
                  setTool(name);
                  setSelected(null);
                  setShowDrawing(true);
                }}
              >
                <span aria-hidden="true">
                  {
                    {
                      select: "↖",
                      line: "╱",
                      arrow: "↗",
                      circle: "○",
                      angle: "∠",
                    }[name]
                  }
                </span>
                {name === "select" ? "Select / move" : name}
              </button>
            ))}
          </div>
          <p className="swing-hint">
            {readOnly
              ? "This shared layer is read-only. Choose My drawings to add your own."
              : tool === "angle"
                ? "Tap three points: start, vertex, end. Escape cancels."
                : tool === "select"
                  ? "Select a drawing to move or delete it."
                  : `Drag across the video to draw a ${tool}.`}
          </p>
          <div
            className="swing-colors"
            role="group"
            aria-label="Drawing colour"
          >
            {DRAWING_COLORS.map((v, i) => (
              <button
                key={v}
                style={{ backgroundColor: v }}
                aria-label={["Gold", "Coral", "Mint", "White"][i]}
                aria-pressed={color === v}
                disabled={readOnly}
                onClick={() => setColor(v)}
              />
            ))}
            <select
              aria-label="Line thickness"
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
              disabled={readOnly}
            >
              <option value="2">Fine</option>
              <option value="3">Medium</option>
              <option value="5">Bold</option>
            </select>
          </div>
          <label className="swing-field">
            New drawings appear
            <select
              value={scope}
              disabled={readOnly}
              onChange={(event) =>
                setScope(event.target.value as "frame" | "video")
              }
            >
              <option value="frame">At this moment only</option>
              <option value="video">Throughout the video</option>
            </select>
          </label>
          <div className="swing-edit-actions">
            <button disabled={readOnly || !past.length} onClick={undo}>
              Undo
            </button>
            <button disabled={readOnly || !future.length} onClick={redo}>
              Redo
            </button>
            <button disabled={readOnly || !selected} onClick={removeSelected}>
              Delete
            </button>
            <button
              disabled={readOnly || !doc.shapes.length}
              onClick={() => {
                if (
                  window.confirm(
                    "Clear all drawings in your layer? You can undo this.",
                  )
                )
                  edit({ ...doc, shapes: [] });
              }}
            >
              Clear
            </button>
          </div>
          <div className="swing-moments">
            <h3>
              Saved moments <span>{activeDocument.shapes.length}/100</span>
            </h3>
            {!activeDocument.shapes.length ? (
              <p className="swing-hint">
                Draw at a key moment to bookmark it here.
              </p>
            ) : (
              <ul>
                {activeDocument.shapes.map((s, i) => (
                  <li key={s.id}>
                    <button
                      aria-pressed={selected === s.id}
                      onClick={() => {
                        seek(s.time, true);
                        setSelected(s.id);
                        setShowDrawing(true);
                        setTool("select");
                      }}
                    >
                      <span style={{ color: s.color }} aria-hidden="true">
                        ●
                      </span>{" "}
                      {i + 1}. {s.type}{" "}
                      <span>
                        {s.scope === "video" ? "All video" : formatTime(s.time)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {info.video.player_question && (
            <div className="swing-question">
              <h3>Player question</h3>
              <p>{info.video.player_question}</p>
            </div>
          )}
          <label className="swing-field">
            My analysis notes
            <textarea
              rows={5}
              maxLength={4000}
              placeholder="What do you see? What should the player work on?"
              value={doc.note}
              onChange={(event) => edit({ ...doc, note: event.target.value })}
            />
          </label>
          <section className="swing-shared-notes" aria-label="Shared player and coach notes">
            <h3>Player & coach feedback</h3>
            {info.annotations.filter((s) => s.author_id !== info.userId).length === 0 &&
              <p>No other saved reviews yet. Use Refresh shared reviews after the other person saves.</p>}
            {info.annotations.filter((s) => s.author_id !== info.userId).map((s, i) => (
              <article key={s.author_id}>
                <h4>{s.author_label || `Shared review ${i + 1}`}</h4>
                <p>{s.document.note || "No written notes in this review."}</p>
                <button onClick={() => openLayer(s.author_id)} disabled={!s.document.shapes.length}>
                  View {s.document.shapes.length} saved drawings
                </button>
              </article>
            ))}
          </section>
          <p className="swing-hint">
            Drawings and notes are shared with the player and authorised linked
            coaches when saved. They are not private drafts.
          </p>
          <div className="swing-save-message" role="status">
            {saveMessage}
          </div>
          <button
            className="swing-primary"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : "Save drawings & notes"}
          </button>
        </aside>
      </div>
    </main>
  );
}
