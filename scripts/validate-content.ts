// Usage: npm run validate-content (requires Node >= 22.18).
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { countCards } from "../src/content/counts.ts";
import { simulatePath } from "../src/engine/simulate.ts";
import { contentRoot, readSurvey } from "./read-survey.ts";

const surveys = readdirSync(resolve(contentRoot, "surveys"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (surveys.length === 0) throw new Error("Nincs kérdőív a content/surveys/ mappában.");

for (const slug of surveys) {
  try {
    const result = readSurvey(slug);
    for (const w of result.warnings) console.warn(`FIGYELEM  ${w.file}  ${w.path}\n          ${w.message}`);
    if (!result.ok) {
      console.error(`HIBA  ${slug}: ${result.issues.length} érvényesítési hiba`);
      for (const i of result.issues) console.error(`  ${i.file}  ${i.path}\n    ${i.message}`);
      process.exitCode = 1;
      continue;
    }

    const { bank, devices, settings } = result;
    console.log(`OK  ${slug}: kérdésbank ${bank.version}, ${bank.cards.length} kártya, ${bank.blocks.length} blokk; eszközfájl ${devices.version}`);
    console.log("\nKitöltési hossz | Kihagyással | Minden eszköz | Nincs eszköz");
    for (const row of countCards(bank, devices)) {
      console.log(`${row.effortLevel ?? row.label} | ${row.skipped} | ${row.allDevices} | ${row.noDevices}`);
    }

    const appliances = devices.appliances.map((a) => a.id);
    const picker = bank.cards.find((c) => c.type === "multi_tiles" && c.devicePicker);
    const offered = picker?.type === "multi_tiles" ? picker.options.map((o) => o.value) : [];
    const notOffered = appliances.filter((a) => !offered.includes(a));
    for (const [name, owned] of [["Nincs eszköz (üres eszközválasztás)", []], ["Minden eszköz", appliances]] as const) {
      const sim = simulatePath(bank, devices, { owned: [...owned], effortLevel: settings.display.defaultEffort });
      console.log(`\n=== ${name}: ${sim.path.length} kártya ===`);
      console.log(sim.path.join(" "));
      const q = Object.entries(sim.quotas);
      console.log(q.length ? `Modulkeretek: ${q.map(([m, n]) => `${m}=${n}`).join(", ")} (összesen ${q.reduce((a, [, n]) => a + n, 0)}, plafon ${devices.globalModuleCap})`
        : "Modulkeretek: nincs aktív modul");
    }
    if (notOffered.length) console.log(`\nAz eszközválasztó nem kínálja fel: ${notOffered.join(", ")}`);
  } catch (error) {
    console.error(`HIBA  ${slug}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
