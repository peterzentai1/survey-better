// The three-level effort setup of bank 0.3.4, kept as a fixture: the engine still supports three
// levels, while the live bank (0.3.5) offers only `rovid` and `alapos`.
import type { Bank } from "../schema.ts";

export const THREE_LEVELS: NonNullable<Bank["effortLevels"]> = [
  { id: "rovid", label: "Rövid · kb. 5 perc", moduleCaps: { tierCaps: { A: 1, B: 1, C: 0 }, globalModuleCap: 3 } },
  { id: "kozepes", label: "Közepes · kb. 8 perc", moduleCaps: { tierCaps: { A: 2, B: 1, C: 1 }, globalModuleCap: 6 } },
  { id: "alapos", label: "Alapos · kb. 9 perc", moduleCaps: { tierCaps: { A: 3, B: 2, C: 1 }, globalModuleCap: 9 } },
];

export function withThreeLevels(bank: Bank): Bank {
  return { ...bank, effortLevels: THREE_LEVELS };
}

/** Loaded survey content with three levels and `kozepes` as the starting level. */
export function withThreeLevelContent<T extends { bank: Bank; settings: { display: { defaultEffort: string } } }>(content: T): T {
  return {
    ...content,
    bank: withThreeLevels(content.bank),
    settings: { ...content.settings, display: { ...content.settings.display, defaultEffort: "kozepes" } },
  } as T;
}
