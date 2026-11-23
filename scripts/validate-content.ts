// Validate content/kerdesbank.hu.yaml + content/eszkozok.yaml and print, for two fixture
// households, the cards that would be shown and the module quotas.
// Usage: npm run validate-content   (needs Node >= 22.18, which runs .ts files directly)
import { readFileSync } from "node:fs";
import { ICON_KEYS } from "../src/ui/iconKeys.ts";
import { simulatePath } from "../src/engine/simulate.ts";
import { parseContent } from "../src/engine/validate.ts";

const root = new URL("../content/", import.meta.url);
const read = (f: string) => readFileSync(new URL(f, root), "utf8");

const result = parseContent(read("kerdesbank.hu.yaml"), read("eszkozok.yaml"), { knownIcons: ICON_KEYS });

for (const w of result.warnings) console.warn(`FIGYELEM  ${w.file}  ${w.path}\n          ${w.message}`);

if (!result.ok) {
  console.error(`\nHIBA: ${result.issues.length} érvényesítési hiba\n`);
  for (const i of result.issues) console.error(`  ${i.file}  ${i.path}\n    ${i.message}`);
  process.exit(1);
}

const { bank, devices } = result;
console.log(`OK  kérdésbank ${bank.version}: ${bank.cards.length} kártya, ${bank.blocks.length} blokk; eszközfájl ${devices.version}`);

const picker = bank.cards.find((c) => c.type === "multi_tiles" && c.devicePicker);
const offered = picker && picker.type === "multi_tiles" ? picker.options.map((o) => o.value) : [];
const allAppliances = devices.appliances.map((a) => a.id);
const notOffered = allAppliances.filter((a) => !offered.includes(a));

const households = [
  { name: "Nincs eszköz (üres eszközválasztás)", owned: [] as string[] },
  { name: "Minden eszköz (amit az eszközválasztó felkínál)", owned: allAppliances },
];

for (const h of households) {
  const sim = simulatePath(bank, devices, { owned: h.owned });
  console.log(`\n=== ${h.name}: ${sim.path.length} kártya ===`);
  console.log(sim.path.join(" "));
  const q = Object.entries(sim.quotas);
  console.log(
    q.length ? `Modulkeretek: ${q.map(([m, n]) => `${m}=${n}`).join(", ")} (összesen ${q.reduce((a, [, n]) => a + n, 0)}, plafon ${devices.globalModuleCap})` : "Modulkeretek: nincs aktív modul",
  );
}
if (notOffered.length) console.log(`\nMegjegyzés: az eszközválasztó nem kínálja fel: ${notOffered.join(", ")}; ezeket a „minden eszköz” háztartás sem birtokolja.`);
