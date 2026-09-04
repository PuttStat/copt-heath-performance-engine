export type ProgrammeLength = 4 | 8 | 12;
export type ProgrammePhase =
  | "Measure"
  | "Build"
  | "Stabilise"
  | "Transfer"
  | "Perform";
export type ProgrammeWeekTemplate = readonly [
  weekNumber: number,
  phase: ProgrammePhase,
  focus: string,
  reviewType: string | null,
];

const fourWeekPlan: readonly ProgrammeWeekTemplate[] = [
  [
    1,
    "Measure",
    "Baseline, success definitions and representative testing",
    "Initial measure",
  ],
  [
    2,
    "Build",
    "Develop the highest-value technical and movement priorities",
    "Progress review",
  ],
  [
    3,
    "Transfer",
    "Test the solution across changing targets and on-course tasks",
    "Transfer review",
  ],
  [
    4,
    "Perform",
    "Final performance test and next-cycle decision",
    "Final retest",
  ],
];

const eightWeekPlan: readonly ProgrammeWeekTemplate[] = [
  [
    1,
    "Measure",
    "Baseline, success definitions and representative testing",
    "Initial measure",
  ],
  [
    2,
    "Measure",
    "Confirm priorities and set the programme route",
    "Priority review",
  ],
  [3, "Build", "Develop the primary technical and movement capacities", null],
  [
    4,
    "Build",
    "Progress the selected solution without losing strike or intent",
    "Progress review",
  ],
  [
    5,
    "Stabilise",
    "Improve repeatability across changing targets",
    "Stability review",
  ],
  [6, "Stabilise", "Validate the pattern without coaching aids", "Retest"],
  [
    7,
    "Transfer",
    "Move the skill into random and on-course tasks",
    "Transfer review",
  ],
  [
    8,
    "Perform",
    "Final performance test and next-cycle decision",
    "Final retest",
  ],
];

const twelveWeekPlan: readonly ProgrammeWeekTemplate[] = [
  [
    1,
    "Measure",
    "Baseline, success definitions and representative testing",
    "Initial measure",
  ],
  [
    2,
    "Measure",
    "Confirm priorities and set the programme route",
    "Priority review",
  ],
  [3, "Build", "Develop the primary technical and movement capacities", null],
  [
    4,
    "Build",
    "Progress the selected solution without losing strike or intent",
    "Progress review",
  ],
  [5, "Build", "Consolidate the highest-value practice pattern", null],
  [
    6,
    "Stabilise",
    "Improve repeatability across changing targets",
    "Stability review",
  ],
  [
    7,
    "Stabilise",
    "Retain the solution as constraints increase",
    "Mid-block review",
  ],
  [8, "Stabilise", "Validate the pattern without coaching aids", "Retest"],
  [
    9,
    "Transfer",
    "Move the skill into random and on-course tasks",
    "Transfer review",
  ],
  [
    10,
    "Transfer",
    "Test strategy, consequence and competitive routines",
    "Competition review",
  ],
  [
    11,
    "Perform",
    "Reduce volume and protect quality for performance",
    "Readiness review",
  ],
  [
    12,
    "Perform",
    "Final performance test and next-cycle decision",
    "Final retest",
  ],
];

export const programmeTemplates: Record<
  ProgrammeLength,
  readonly ProgrammeWeekTemplate[]
> = {
  4: fourWeekPlan,
  8: eightWeekPlan,
  12: twelveWeekPlan,
};

export function programmeTemplate(length: ProgrammeLength) {
  return programmeTemplates[length];
}
