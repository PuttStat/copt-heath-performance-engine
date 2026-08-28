"use client";
import { useRef, useState, type PointerEvent } from "react";
import {
  angleDegrees,
  clamp,
  type Drawing,
  type DrawingTool,
  type Point,
} from "@/src/lib/video-analysis";
type Props = {
  shapes: Drawing[];
  tool: DrawingTool | "select";
  color: string;
  width: number;
  time: number;
  scope: "frame" | "video";
  aspect: number;
  readOnly: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (shape: Drawing) => void;
  onMove: (shape: Drawing) => void;
  onPause: () => void;
};
export function DrawingOverlay(props: Props) {
  const { shapes, tool, aspect, selected, readOnly } = props;
  const [draft, setDraft] = useState<Point[]>([]);
  const [moving, setMoving] = useState<Drawing | null>(null);
  const gesture = useRef<{ start: Point; shape?: Drawing } | null>(null);
  const height = 1000 / aspect;
  function point(event: PointerEvent<SVGSVGElement>): Point {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - r.left) / r.width, 0, 1),
      y: clamp((event.clientY - r.top) / r.height, 0, 1),
    };
  }
  function add(points: Point[]) {
    props.onAdd({
      id: crypto.randomUUID(),
      type: tool as DrawingTool,
      points,
      time: props.time,
      color: props.color,
      width: props.width,
      scope: props.scope,
    });
    setDraft([]);
  }
  function down(event: PointerEvent<SVGSVGElement>) {
    if (readOnly || !event.isPrimary || event.button !== 0) return;
    event.currentTarget
      .closest<HTMLElement>(".swing-studio")
      ?.focus({ preventScroll: true });
    props.onPause();
    const p = point(event);
    if (tool === "angle") {
      const points = [...draft, p];
      if (points.length === 3) add(points);
      else setDraft(points);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "select") {
      const id =
        (event.target as Element)
          .closest("[data-shape]")
          ?.getAttribute("data-shape") ?? null;
      props.onSelect(id);
      const shape = shapes.find((s) => s.id === id);
      if (shape) {
        gesture.current = { start: p, shape };
        setMoving(shape);
      }
    } else {
      gesture.current = { start: p };
      setDraft([p, p]);
    }
  }
  function translated(shape: Drawing, start: Point, end: Point): Drawing {
    const dx = clamp(
      end.x - start.x,
      -Math.min(...shape.points.map((a) => a.x)),
      1 - Math.max(...shape.points.map((a) => a.x)),
    );
    const dy = clamp(
      end.y - start.y,
      -Math.min(...shape.points.map((a) => a.y)),
      1 - Math.max(...shape.points.map((a) => a.y)),
    );
    return {
      ...shape,
      points: shape.points.map((a) => ({ x: a.x + dx, y: a.y + dy })),
    };
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const active = gesture.current;
    if (!active || readOnly) return;
    const p = point(event);
    if (active.shape) setMoving(translated(active.shape, active.start, p));
    else setDraft([active.start, p]);
  }
  function up(event: PointerEvent<SVGSVGElement>) {
    const active = gesture.current;
    if (!active) return;
    const p = point(event);
    if (active.shape) {
      if (Math.hypot(p.x - active.start.x, p.y - active.start.y) > 0.001)
        props.onMove(translated(active.shape, active.start, p));
    } else if (
      tool !== "select" &&
      Math.hypot(p.x - active.start.x, p.y - active.start.y) > 0.004
    )
      add([active.start, p]);
    gesture.current = null;
    setMoving(null);
    setDraft([]);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function renderShape(shape: Drawing, preview = false) {
    const pts = shape.points.map((p) => ({ x: p.x * 1000, y: p.y * height }));
    const [a, b, c] = pts;
    if (!a) return null;
    const degrees =
      shape.type === "angle" ? angleDegrees(shape.points, aspect) : null;
    const rotation = b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
    const arrow = b
      ? `${b.x - 16 * Math.cos(rotation - 0.45)},${b.y - 16 * Math.sin(rotation - 0.45)} ${b.x},${b.y} ${b.x - 16 * Math.cos(rotation + 0.45)},${b.y - 16 * Math.sin(rotation + 0.45)}`
      : "";
    return (
      <g
        key={shape.id}
        data-shape={preview ? undefined : shape.id}
        stroke={shape.color}
        strokeWidth={shape.width * 1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={preview ? 0.8 : 1}
      >
        {shape.type === "circle" && b ? (
          <ellipse
            cx={(a.x + b.x) / 2}
            cy={(a.y + b.y) / 2}
            rx={Math.abs(a.x - b.x) / 2}
            ry={Math.abs(a.y - b.y) / 2}
          />
        ) : b ? (
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        ) : null}
        {shape.type === "arrow" && b && <polyline points={arrow} />}
        {shape.type === "angle" && b && c && (
          <>
            <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} />
            <text
              x={clamp(b.x + 14, 30, 880)}
              y={clamp(b.y - 14, 28, height - 10)}
              fontSize="26"
              fontWeight="700"
              fill={shape.color}
              stroke="#102a24"
              strokeWidth="4"
              paintOrder="stroke"
            >
              {degrees === null ? "—" : `${degrees.toFixed(1)}°`}
            </text>
          </>
        )}
        {(selected === shape.id || preview) &&
          pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="7"
              fill={shape.color}
              stroke="#102a24"
              strokeWidth="2"
            />
          ))}
        {!preview &&
          tool === "select" &&
          !readOnly &&
          b &&
          (shape.type === "circle" ? (
            <ellipse
              cx={(a.x + b.x) / 2}
              cy={(a.y + b.y) / 2}
              rx={Math.abs(a.x - b.x) / 2}
              ry={Math.abs(a.y - b.y) / 2}
              stroke="transparent"
              strokeWidth="24"
            />
          ) : (
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke="transparent"
              strokeWidth="24"
            />
          ))}
      </g>
    );
  }
  return (
    <svg
      className={`swing-overlay ${tool === "select" ? "is-select" : ""}`}
      viewBox={`0 0 1000 ${height}`}
      role="img"
      aria-label="Video drawing canvas. Drag to draw; angle tool uses three taps: start, vertex, end."
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        gesture.current = null;
        setMoving(null);
        setDraft([]);
      }}
    >
      {shapes.map((s) => renderShape(moving?.id === s.id ? moving : s))}
      {!!draft.length &&
        tool !== "select" &&
        renderShape(
          {
            id: "draft",
            type: tool,
            points: draft,
            color: props.color,
            width: props.width,
            time: props.time,
            scope: props.scope,
          },
          true,
        )}
    </svg>
  );
}
