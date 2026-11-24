export const EFFORT_LEVEL_IDS = ["rovid", "kozepes", "alapos"] as const;
export type EffortLevelId = (typeof EFFORT_LEVEL_IDS)[number];

export const DEFAULT_EFFORT_LEVEL: EffortLevelId = "alapos";

export function nextEffortLevel(level: EffortLevelId | undefined): EffortLevelId | undefined {
  return level === undefined ? undefined : EFFORT_LEVEL_IDS.at(EFFORT_LEVEL_IDS.indexOf(level) + 1);
}
