import type { PracticePriority, ShotBandResult } from "./domain";

/**
 * Package 7B boundary for the spreadsheet-derived priority calculation.
 * Frequency prevents a single rare failure (for example one bunker shot)
 * from dominating the plan. Package 7D will calibrate weights against v2.5.
 */
export function rankPracticePriorities(rows: ShotBandResult[]): PracticePriority[] {
  const total = rows.reduce((sum, row) => sum + (row.opportunities ?? 0), 0);
  return rows.map((row) => {
    const attempts = row.opportunities ?? 0;
    const successRate = attempts > 0 ? (row.successes ?? 0) / attempts : null;
    const frequency = total > 0 ? attempts / total : 0;
    const evidence = Math.min(1, attempts / 5);
    const priorityScore = successRate === null ? 0 : frequency * (1 - successRate) * evidence;
    return { bandId: row.bandId, frequency, successRate, evidence, priorityScore };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
