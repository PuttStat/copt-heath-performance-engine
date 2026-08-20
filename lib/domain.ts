export type ShotBandId = "tee" | "over-200" | "150-200" | "125-150" | "100-125" | "50-100" | "under-50" | "bunker" | "putt-0-6" | "putt-6-plus";
export type ShotBandResult = { bandId: ShotBandId; opportunities: number | null; successes: number | null };
export type RoundDraft = { id: string; playedAt: string | null; courseName: string; bands: ShotBandResult[] };
export type PracticePriority = { bandId: ShotBandId; frequency: number; successRate: number | null; evidence: number; priorityScore: number };
