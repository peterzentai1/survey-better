// All known effort levels, shortest first. A bank may offer any of them, in this order;
// a card's `effort` value N appears from the N-th level of this list onward.
export const EFFORT_LEVEL_IDS = ["rovid", "kozepes", "alapos"] as const;
export type EffortLevelId = (typeof EFFORT_LEVEL_IDS)[number];

export const DEFAULT_EFFORT_LEVEL: EffortLevelId = "kozepes";

/** The next longer level among those the bank offers, or undefined at the longest. */
export function nextEffortLevel(
  level: EffortLevelId | undefined,
  offered: readonly EffortLevelId[] = EFFORT_LEVEL_IDS,
): EffortLevelId | undefined {
  if (level === undefined) return undefined;
  const i = offered.indexOf(level);
  return i < 0 ? undefined : offered[i + 1];
}
