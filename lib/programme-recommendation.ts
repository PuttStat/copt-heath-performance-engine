import type { DiagnosticObservation } from "./diagnostic-engine";

export type PlanningPhase = "Measure" | "Build" | "Stabilise" | "Transfer" | "Perform";

export type RecommendationLibraryItem = {
  id: string;
  code: string;
  title: string;
  item_type: "golf_drill" | "vector_exercise";
  category?: string | null;
  stage?: string | null;
  purpose: string;
  dosage: string | null;
  pass_criterion: string | null;
  equipment?: string | null;
  guardrails?: string | null;
  instruction_complete: boolean;
};

export type ApprovedPrescription = {
  item: RecommendationLibraryItem;
  caseId: string;
  priorityScore: number;
  rationale: string;
};

export type PlanRecommendation = {
  item: RecommendationLibraryItem;
  sourceCaseId: string | null;
  score: number;
  rationale: string;
  evidence: {
    shotBand: string;
    opportunities: number;
    successes: number;
    confidence: string;
    priorityScore: number;
  } | null;
  requiresReview: boolean;
};

export type PlanRecommendations = {
  golf: PlanRecommendation[];
  vector: PlanRecommendation[];
  evidenceSummary: string;
  requiresReview: boolean;
};

const phaseCodePreference: Record<PlanningPhase, number[]> = {
  Measure: [0, 1, 2],
  Build: [1, 2, 0],
  Stabilise: [2, 1, 0],
  Transfer: [2, 1, 0],
  Perform: [2, 0, 1],
};

const lower = (value: string | null | undefined) => (value || "").toLowerCase();

export function equipmentAvailable(item: RecommendationLibraryItem, facilities: string[]) {
  if (!facilities.length || !item.equipment) return true;
  const equipment = lower(item.equipment), available = facilities.map(lower);
  const has = (value: string) => available.some((entry) => entry.includes(value));
  if (/(launch monitor|radar)/.test(equipment)) return has("launch monitor");
  if (/(putting green)/.test(equipment)) return has("putting green");
  if (/(bunker|short.game)/.test(equipment)) return has("short-game");
  if (/(driving range|balls|target)/.test(equipment) && item.item_type === "golf_drill")
    return has("driving range") || has("golf course") || has("short-game") || has("putting green");
  if (/(barbell|trap bar|cable|landmine|dumbbell|kettlebell|medicine ball|bench|bike|treadmill)/.test(equipment))
    return has("gym") || has("home equipment");
  return true;
}

function phaseRank(code: string, codes: string[], phase: PlanningPhase) {
  const index = codes.indexOf(code), preference = phaseCodePreference[phase];
  const position = preference.indexOf(index);
  return position < 0 ? preference.length : position;
}

export function recommendPlanItems({
  library,
  observations,
  approved = [],
  phase,
  facilities = [],
  recoveryConstraints = "",
}: {
  library: RecommendationLibraryItem[];
  observations: DiagnosticObservation[];
  approved?: ApprovedPrescription[];
  phase: PlanningPhase;
  facilities?: string[];
  recoveryConstraints?: string;
}): PlanRecommendations {
  const byCode = new Map(library.filter((item) => item.instruction_complete).map((item) => [item.code, item]));
  const chosen = new Map<string, PlanRecommendation>();
  const add = (recommendation: PlanRecommendation) => {
    const current = chosen.get(recommendation.item.id);
    if (!current || recommendation.score > current.score) chosen.set(recommendation.item.id, recommendation);
  };

  for (const prescription of approved) {
    if (!prescription.item.instruction_complete || !equipmentAvailable(prescription.item, facilities)) continue;
    add({
      item: prescription.item,
      sourceCaseId: prescription.caseId,
      score: 10_000 + prescription.priorityScore * 100,
      rationale: prescription.rationale || "Coach-approved prescription from the player's evidence.",
      evidence: null,
      requiresReview: false,
    });
  }

  observations.forEach((observation, observationIndex) => {
    const confidenceWeight = Math.max(0.2, observation.confidenceScore / 100);
    const orderedCodes = [...observation.suggestedCodes].sort(
      (a, b) => phaseRank(a, observation.suggestedCodes, phase) - phaseRank(b, observation.suggestedCodes, phase),
    );
    orderedCodes.forEach((code, codeIndex) => {
      const item = byCode.get(code);
      if (!item || !equipmentAvailable(item, facilities)) return;
      const physical = item.item_type === "vector_exercise";
      const score = observation.priorityScore * confidenceWeight * 1_000 - observationIndex * 10 - codeIndex;
      add({
        item,
        sourceCaseId: null,
        score,
        rationale: `${observation.band} is ranked as a practice priority (${observation.evidenceSummary}). ${item.title} is the ${phase.toLowerCase()}-phase option linked to that evidence.`,
        evidence: {
          shotBand: observation.band,
          opportunities: observation.opportunities,
          successes: observation.successes,
          confidence: observation.confidence,
          priorityScore: observation.priorityScore,
        },
        requiresReview: physical && recoveryConstraints.trim().length > 0,
      });
    });
  });

  const ranked = [...chosen.values()].sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
  const golf = ranked.filter((item) => item.item.item_type === "golf_drill");
  const vector = ranked.filter((item) => item.item.item_type === "vector_exercise");
  const leading = observations[0];
  return {
    golf,
    vector,
    evidenceSummary: leading
      ? `Primary priority: ${leading.band}. ${leading.evidenceSummary}`
      : "No usable playing evidence is available yet. Record rounds or practice results before generating a personalised plan.",
    requiresReview: [...golf, ...vector].some((item) => item.requiresReview),
  };
}

export function recommendationForSession(
  recommendations: PlanRecommendation[],
  weekNumber: number,
  sessionIndex: number,
) {
  if (!recommendations.length) return null;
  return recommendations[(Math.max(1, weekNumber) - 1 + sessionIndex) % recommendations.length];
}

export function splitMinutes(total: number, count: number) {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from(
    { length: safeCount },
    (_, index) => Math.floor(total / safeCount) + (index < total % safeCount ? 1 : 0),
  );
}

export type WorkoutRecommendation = PlanRecommendation & {
  role: "power" | "strength" | "support" | "conditioning";
  minutes: number;
};

function workoutRole(item: RecommendationLibraryItem): WorkoutRecommendation["role"] {
  const text = lower(`${item.code} ${item.category} ${item.title}`);
  if (/condition|cardio|aerobic|bike|walk|treadmill|interval/.test(text)) return "conditioning";
  if (/power|speed|jump|throw|sprint/.test(text)) return "power";
  if (/row|press|carry|rotation|anti-|mobility|shoulder|trunk/.test(text)) return "support";
  return "strength";
}

function weightedWorkoutMinutes(total: number, count: number) {
  if (count <= 1) return [total];
  const conditioning = Math.max(1, Math.min(total - count + 1, Math.round(total * 0.4)));
  const rest = Math.max(0, total - conditioning);
  return [...splitMinutes(rest, count - 1), conditioning];
}

export function buildVectorWorkout({
  recommended,
  library,
  phase,
  facilities = [],
  totalMinutes,
  workoutIndex = 0,
}: {
  recommended: PlanRecommendation[];
  library: RecommendationLibraryItem[];
  phase: PlanningPhase;
  facilities?: string[];
  totalMinutes: number;
  workoutIndex?: number;
}): WorkoutRecommendation[] {
  if (totalMinutes <= 0) return [];
  const target = totalMinutes < 20 ? 2 : totalMinutes < 40 ? 3 : totalMinutes < 60 ? 4 : 5;
  const suitable = library.filter(
    (item) => item.item_type === "vector_exercise" && item.instruction_complete && equipmentAvailable(item, facilities),
  );
  const desired = Math.min(target, totalMinutes, suitable.length);
  if (!desired) return [];
  const recommendedById = new Map(recommended.map((entry) => [entry.item.id, entry]));
  const roleOrder: WorkoutRecommendation["role"][] =
    phase === "Transfer" || phase === "Perform"
      ? ["power", "strength", "support", "strength", "conditioning"]
      : ["strength", "support", "power", "strength", "conditioning"];
  const selected: RecommendationLibraryItem[] = [];
  const unused = () => suitable.filter((item) => !selected.some((chosen) => chosen.id === item.id));
  for (const role of roleOrder.slice(0, desired - 1)) {
    const candidates = unused().filter((item) => workoutRole(item) === role);
    const pool = candidates.length ? candidates : unused().filter((item) => workoutRole(item) !== "conditioning");
    if (pool.length) selected.push(pool[(workoutIndex + selected.length) % pool.length]);
  }
  const conditioning = unused().filter((item) => workoutRole(item) === "conditioning");
  if (conditioning.length) selected.push(conditioning[workoutIndex % conditioning.length]);
  while (selected.length < desired && unused().length) selected.push(unused()[0]);
  const minutes = weightedWorkoutMinutes(totalMinutes, selected.length);
  return selected.map((item, index) => {
    const prior = recommendedById.get(item.id);
    const role = workoutRole(item);
    return {
      item,
      sourceCaseId: prior?.sourceCaseId || null,
      score: prior?.score || 100 - index,
      rationale: prior?.rationale || `Vector selected this as the ${role} component of a balanced ${phase.toLowerCase()}-phase workout.`,
      evidence: prior?.evidence || null,
      requiresReview: prior?.requiresReview || false,
      role,
      minutes: minutes[index],
    };
  });
}
