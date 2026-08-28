// Shared, dependency-free validation and geometry for the 7I.2 editor.
export const DRAWING_COLORS = [
  "#f4c95d",
  "#ff5f57",
  "#5ed6b5",
  "#ffffff",
] as const;
export const DRAWING_TOOLS = ["line", "arrow", "circle", "angle"] as const;
export type DrawingTool = (typeof DRAWING_TOOLS)[number];
export type Point = { x: number; y: number };
export type Drawing = {
  id: string;
  type: DrawingTool;
  points: Point[];
  color: string;
  width: number;
  time: number;
  scope: "frame" | "video";
};
export type AnalysisDocument = { version: 1; shapes: Drawing[]; note: string };
export type AnnotationSet = {
  author_id: string;
  author_label?: string;
  revision: number;
  document: AnalysisDocument;
  updated_at: string;
};
// Open a saved drawing instead of silently starting before all annotations.
export function firstDrawingTime(document: AnalysisDocument): number {
  return document.shapes.length
    ? Math.min(...document.shapes.map((shape) => shape.time))
    : 0;
}
export function zoomTransform(zoom: number, x: number, y: number) {
  const scale = clamp(zoom, 1, 4);
  const limit = (scale - 1) * 50;
  return `translate(${clamp(x, -100, 100) * limit / 100}%, ${clamp(y, -100, 100) * limit / 100}%) scale(${scale})`;
}
export const emptyDocument = (): AnalysisDocument => ({
  version: 1,
  shapes: [],
  note: "",
});
export const isUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export function canAccessVideo(
  userId: string,
  playerId: string,
  role: string,
  linked: boolean,
) {
  return (
    userId === playerId || (linked && (role === "coach" || role === "admin"))
  );
}
export function validateDocument(
  value: unknown,
  duration: number,
): value is AnalysisDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as AnalysisDocument;
  if (
    doc.version !== 1 ||
    typeof doc.note !== "string" ||
    doc.note.length > 4000 ||
    !Array.isArray(doc.shapes) ||
    doc.shapes.length > 100
  )
    return false;
  const ids = new Set<string>();
  for (const s of doc.shapes) {
    if (
      !s ||
      typeof s !== "object" ||
      typeof s.id !== "string" ||
      !isUUID(s.id) ||
      ids.has(s.id)
    )
      return false;
    ids.add(s.id);
    if (
      !DRAWING_TOOLS.includes(s.type) ||
      !DRAWING_COLORS.includes(s.color as (typeof DRAWING_COLORS)[number]) ||
      ![2, 3, 5].includes(s.width) ||
      !["frame", "video"].includes(s.scope) ||
      !Number.isFinite(s.time) ||
      s.time < 0 ||
      s.time > duration + 0.1 ||
      !Array.isArray(s.points) ||
      s.points.length !== (s.type === "angle" ? 3 : 2)
    )
      return false;
    if (
      !s.points.every(
        (p) =>
          p &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 0 &&
          p.x <= 1 &&
          p.y >= 0 &&
          p.y <= 1,
      )
    )
      return false;
  }
  return true;
}
export function angleDegrees(points: Point[], aspect: number) {
  if (points.length !== 3) return null;
  const [a, b, c] = points;
  const u = { x: (a.x - b.x) * aspect, y: a.y - b.y },
    v = { x: (c.x - b.x) * aspect, y: c.y - b.y };
  const length = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  return length < 0.000001
    ? null
    : (Math.acos(clamp((u.x * v.x + u.y * v.y) / length, -1, 1)) * 180) /
        Math.PI;
}
export function stepTime(
  time: number,
  direction: number,
  fps: number,
  duration: number,
) {
  return clamp(
    time + direction / (Number.isFinite(fps) && fps > 0 ? fps : 30),
    0,
    duration,
  );
}
export function drawingVisible(shape: Drawing, time: number, fps: number) {
  return (
    shape.scope === "video" ||
    Math.abs(shape.time - time) <= 0.55 / Math.max(1, fps)
  );
}
export function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00.000";
  const ms = Math.round(Math.max(0, value) * 1000);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
