import type { RecommendationLibraryItem } from "./programme-recommendation";

export type SwingMovement = {
  id: string;
  code: string;
  p_position: string;
  title: string;
  body_target: string;
  pressure_target: string;
  hands_arms_target: string;
  shaft_face_target: string;
  incorrect_patterns: string;
  rehearsal: string;
  acceptance_gate: string;
  applicable_categories: string[];
};

export type SwingMovementSuggestion = {
  movement: SwingMovement | null;
  rationale: string;
};

const positionRules: Array<[RegExp, string, string]> = [
  [/address|alignment|ball position|setup/, "P1", "address and alignment checkpoint"],
  [/takeaway|start line|early|inside|outside/, "P2", "early club and body motion checkpoint"],
  [/lead arm|width|depth/, "P3", "lead-arm and depth checkpoint"],
  [/top|backswing|length/, "P4", "top-of-backswing checkpoint"],
  [/transition|re.?route|pump/, "P5", "transition checkpoint"],
  [/delivery|shaft|hand path|under.?plane|over.?plane|path/, "P6", "delivery checkpoint"],
  [/face|strike|contact|low point|attack|loft|fat|thin|toe|heel|shank/, "P7", "impact checkpoint"],
  [/exit|chest through|through.?swing/, "P8", "early follow-through checkpoint"],
  [/rotation|follow.?through/, "P9", "follow-through checkpoint"],
  [/finish|balance/, "P10", "finish checkpoint"],
];

export function suggestSwingMovement(
  item: RecommendationLibraryItem | null | undefined,
  movements: SwingMovement[],
): SwingMovementSuggestion {
  if (!item || item.item_type !== "golf_drill")
    return { movement: null, rationale: "Swing movement aids are attached only to golf practice drills." };

  const text = `${item.code} ${item.title} ${item.category || ""} ${item.purpose || ""}`.toLowerCase();
  if (/putt|putting|bunker|chip|pitch|short game/.test(text))
    return {
      movement: null,
      rationale: "The stock 7-iron P-system model is not automatically applied to putting or short-game technique.",
    };

  const match = positionRules.find(([pattern]) => pattern.test(text));
  const position = match?.[1] || "P7";
  const reason = match?.[2] || "stock full-swing impact checkpoint";
  const movement = movements.find((candidate) => candidate.p_position === position) || null;
  return {
    movement,
    rationale: movement
      ? `Vector paired this drill with the ${reason}. This is a rehearsal aid, not a diagnosis; the coach should confirm it from swing evidence.`
      : `No approved ${position} movement is available.`,
  };
}
