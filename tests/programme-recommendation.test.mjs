import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVectorWorkout,
  recommendPlanItems,
  recommendationForSession,
  splitMinutes,
} from "../lib/programme-recommendation.ts";
import { suggestSwingMovement } from "../lib/swing-movement-recommendation.ts";

const item = (code, item_type = "golf_drill", equipment = "") => ({
  id: code,
  code,
  title: code,
  item_type,
  category: "Test",
  stage: "Build",
  purpose: `Purpose ${code}`,
  dosage: "3 x 5",
  pass_criterion: "Pass",
  equipment,
  guardrails: null,
  instruction_complete: true,
});

const observation = {
  band: "Tee shot",
  opportunities: 10,
  successes: 4,
  failureRate: 0.6,
  frequency: 0.5,
  priorityScore: 0.3,
  confidence: "strong",
  confidenceScore: 90,
  pattern: "Right is the leading miss",
  patternKey: "right",
  evidenceSummary: "4/10 successful",
  interpretation: "Outcome pattern",
  nextTest: "Comparison test",
  guardrail: "Do not infer cause",
  suggestedCodes: ["DR-3A-01", "DR-3A-02", "DR-3A-26", "VEC-PWR-03"],
};

test("Vector ranks data-linked drills and changes the lead option by phase", () => {
  const library = [item("DR-3A-01"), item("DR-3A-02"), item("DR-3A-26"), item("VEC-PWR-03", "vector_exercise")];
  const measure = recommendPlanItems({ library, observations: [observation], phase: "Measure" });
  const build = recommendPlanItems({ library, observations: [observation], phase: "Build" });
  assert.equal(measure.golf[0].item.code, "DR-3A-01");
  assert.equal(build.golf[0].item.code, "DR-3A-02");
  assert.equal(build.vector[0].item.code, "VEC-PWR-03");
  assert.match(build.golf[0].rationale, /Tee shot/);
});

test("coach-approved prescriptions outrank automatic suggestions but remain editable", () => {
  const automatic = item("DR-3A-01"), approvedItem = item("DR-3A-40");
  const plan = recommendPlanItems({
    library: [automatic, approvedItem],
    observations: [observation],
    approved: [{ item: approvedItem, caseId: "case-1", priorityScore: 0.2, rationale: "Coach verified strike pattern." }],
    phase: "Build",
  });
  assert.equal(plan.golf[0].item.code, "DR-3A-40");
  assert.equal(plan.golf[0].sourceCaseId, "case-1");
  assert.match(plan.golf[0].rationale, /Coach verified/);
});

test("facilities filter unsuitable equipment and recovery constraints flag exercise review", () => {
  const plan = recommendPlanItems({
    library: [item("DR-3A-01"), item("VEC-PWR-03", "vector_exercise", "Medicine ball and wall")],
    observations: [observation],
    phase: "Build",
    facilities: ["Home equipment"],
    recoveryConstraints: "Previous knee pain",
  });
  assert.equal(plan.vector.length, 1);
  assert.equal(plan.vector[0].requiresReview, true);
  assert.equal(plan.requiresReview, true);
  const unavailable = recommendPlanItems({
    library: [item("DR-3A-01"), item("VEC-PWR-03", "vector_exercise", "Medicine ball and wall")],
    observations: [observation],
    phase: "Build",
    facilities: ["Putting green"],
  });
  assert.equal(unavailable.vector.length, 0);
});

test("session rotation and exact minute reconciliation are deterministic", () => {
  const recommendations = [
    { item: item("A"), sourceCaseId: null, score: 2, rationale: "A", evidence: null, requiresReview: false },
    { item: item("B"), sourceCaseId: null, score: 1, rationale: "B", evidence: null, requiresReview: false },
  ];
  assert.equal(recommendationForSession(recommendations, 1, 0).item.code, "A");
  assert.equal(recommendationForSession(recommendations, 2, 0).item.code, "B");
  assert.deepEqual(splitMinutes(181, 3), [61, 60, 60]);
  assert.equal(splitMinutes(181, 3).reduce((sum, value) => sum + value, 0), 181);
});

test("no evidence produces no invented prescription", () => {
  const plan = recommendPlanItems({ library: [item("DR-3A-01")], observations: [], phase: "Measure" });
  assert.equal(plan.golf.length, 0);
  assert.match(plan.evidenceSummary, /No usable playing evidence/);
});

test("a 60 minute Vector workout contains several roles and reconciles exactly", () => {
  const vector = [
    { ...item("VEC-STR-01", "vector_exercise"), title: "Goblet squat", category: "Strength" },
    { ...item("VEC-STR-06", "vector_exercise"), title: "Single arm row", category: "Strength" },
    { ...item("VEC-PWR-01", "vector_exercise"), title: "Medicine ball throw", category: "Power" },
    { ...item("VEC-UNI-05", "vector_exercise"), title: "Pallof press", category: "Unilateral" },
    { ...item("VEC-CON-01", "vector_exercise"), title: "Bike intervals", category: "Conditioning" },
  ];
  const workout = buildVectorWorkout({ recommended: [], library: vector, phase: "Build", totalMinutes: 60 });
  assert.equal(workout.length, 5);
  assert.equal(workout.reduce((total, block) => total + block.minutes, 0), 60);
  assert.equal(workout.at(-1).role, "conditioning");
  assert.equal(new Set(workout.map((block) => block.item.id)).size, workout.length);
});

test("full swing drills receive a changeable P-system movement suggestion", () => {
  const movements = ["P1", "P6", "P7"].map((position) => ({
    id: position, code: `VSM-${position}`, p_position: position, title: position,
    body_target: "", pressure_target: "", hands_arms_target: "", shaft_face_target: "",
    incorrect_patterns: "", rehearsal: "", acceptance_gate: "", applicable_categories: ["full swing"],
  }));
  const drill = { ...item("DRILL-PATH"), title: "Delivery path station", category: "Long game" };
  const suggestion = suggestSwingMovement(drill, movements);
  assert.equal(suggestion.movement?.p_position, "P6");
  assert.match(suggestion.rationale, /not a diagnosis/i);
});

test("stock 7-iron P-system movement is not imposed on putting", () => {
  const drill = { ...item("PUTT-01"), title: "Putting gate", category: "Putting" };
  const suggestion = suggestSwingMovement(drill, []);
  assert.equal(suggestion.movement, null);
  assert.match(suggestion.rationale, /not automatically applied/i);
});
