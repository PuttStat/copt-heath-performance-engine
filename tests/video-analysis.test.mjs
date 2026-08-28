import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessVideo,
  validateDocument,
  emptyDocument,
  angleDegrees,
  stepTime,
  drawingVisible,
  formatTime,
  firstDrawingTime,
  zoomTransform,
} from "../src/lib/video-analysis.ts";
const drawing = () => ({
  id: "11111111-1111-4111-8111-111111111111",
  type: "line",
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.9 },
  ],
  color: "#f4c95d",
  width: 3,
  time: 1,
  scope: "frame",
});
test("saved drawings reopen at the first annotated time", () => {
  assert.equal(firstDrawingTime(emptyDocument()), 0);
  const doc = { ...emptyDocument(), shapes: [{ ...drawing(), time: 3 }, drawing()] };
  const time = firstDrawingTime(doc);
  assert.equal(time, 1);
  assert.ok(doc.shapes.some((s) => drawingVisible(s, time, 60)));
});
test("zoom keeps panning bounded and resets to the original viewport", () => {
  assert.equal(zoomTransform(1, 100, -100), 'translate(0%, 0%) scale(1)');
  assert.equal(zoomTransform(2, 100, -100), 'translate(50%, -50%) scale(2)');
  assert.equal(zoomTransform(9, 200, -200), 'translate(150%, -150%) scale(4)');
});
test("access requires ownership or a coach/admin relationship", () => {
  assert.equal(canAccessVideo("a", "a", "player", false), true);
  assert.equal(canAccessVideo("b", "a", "coach", true), true);
  assert.equal(canAccessVideo("b", "a", "admin", true), true);
  for (const role of ["coach", "admin", "player"])
    assert.equal(canAccessVideo("b", "a", role, false), false);
  assert.equal(canAccessVideo("b", "a", "player", true), false);
});
test("valid normalized documents", () => {
  assert.equal(validateDocument(emptyDocument(), 10), true);
  assert.equal(
    validateDocument({ version: 1, shapes: [drawing()], note: "Posture" }, 10),
    true,
  );
});
test("reject unsafe geometry, styles, timestamps and duplicate ids", () => {
  for (const change of [
    { time: NaN },
    { time: -1 },
    { time: 30 },
    { color: "url(https://example.com)" },
    { width: 99 },
    { scope: "public" },
    { id: "bad" },
    { type: "script" },
    {
      points: [
        { x: 1.1, y: 0 },
        { x: 0, y: 0 },
      ],
    },
    {
      points: [
        { x: 0, y: Infinity },
        { x: 0, y: 0 },
      ],
    },
    { points: [] },
  ])
    assert.equal(
      validateDocument(
        { version: 1, shapes: [{ ...drawing(), ...change }], note: "" },
        10,
      ),
      false,
    );
  assert.equal(
    validateDocument(
      { version: 1, shapes: [drawing(), drawing()], note: "" },
      10,
    ),
    false,
  );
});
test("bounded documents and three-point angles", () => {
  assert.equal(
    validateDocument({ ...emptyDocument(), note: "a".repeat(4001) }, 10),
    false,
  );
  assert.equal(
    validateDocument(
      { ...emptyDocument(), shapes: Array(101).fill(drawing()) },
      10,
    ),
    false,
  );
  assert.equal(
    validateDocument(
      { ...emptyDocument(), shapes: [{ ...drawing(), type: "angle" }] },
      10,
    ),
    false,
  );
  assert.equal(
    validateDocument(
      {
        ...emptyDocument(),
        shapes: [
          {
            ...drawing(),
            type: "angle",
            points: [
              { x: 0, y: 0 },
              { x: 0.5, y: 0.5 },
              { x: 1, y: 0 },
            ],
          },
        ],
      },
      10,
    ),
    true,
  );
});
test("angles respect video geometry", () => {
  assert.equal(
    angleDegrees(
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      16 / 9,
    ),
    90,
  );
  assert.ok(
    Math.abs(
      angleDegrees(
        [
          { x: 1, y: 0 },
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        2,
      ) - 26.565051177,
    ) < 1e-6,
  );
  assert.equal(
    angleDegrees(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      9 / 16,
    ),
    null,
  );
});
test("frame steps clamp and fall back to 30fps", () => {
  assert.equal(stepTime(0, -1, 30, 5), 0);
  assert.equal(stepTime(5, 1, 30, 5), 5);
  assert.ok(Math.abs(stepTime(1, 1, 60, 5) - 1 - 1 / 60) < 1e-10);
  assert.equal(stepTime(0, 1, NaN, 5), 1 / 30);
});
test("moment and whole-video visibility", () => {
  assert.equal(drawingVisible(drawing(), 1, 30), true);
  assert.equal(drawingVisible(drawing(), 2, 30), false);
  assert.equal(drawingVisible({ ...drawing(), scope: "video" }, 2, 30), true);
});
test("millisecond time formatting", () => {
  assert.equal(formatTime(59.9999), "1:00.000");
  assert.equal(formatTime(1 / 30), "0:00.033");
  assert.equal(formatTime(NaN), "0:00.000");
});
