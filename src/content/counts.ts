import type { Bank, Devices } from "../engine/schema.ts";
import { simulatePath } from "../engine/simulate.ts";

export function countCards(bank: Bank, devices: Devices) {
  const owned = devices.appliances.map((appliance) => appliance.id);
  const levels = bank.effortLevels ?? [{ id: undefined, label: "Minden kitöltés" }];
  return levels.map(({ id: effortLevel, label }) => ({
    effortLevel,
    label: label.split(" · ")[0],
    skipped: simulatePath(bank, devices, { effortLevel, defaultPolicy: "skip" }).path.length,
    allDevices: simulatePath(bank, devices, { effortLevel, owned }).path.length,
    noDevices: simulatePath(bank, devices, { effortLevel }).path.length,
  }));
}
