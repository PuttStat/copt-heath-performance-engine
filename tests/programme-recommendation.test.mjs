import test from "node:test";
import assert from "node:assert/strict";
import {
  recommendPlanItems,
  recommendationForSession,
  splitMinutes,
} from "../lib/programme-recommendation.ts";

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
