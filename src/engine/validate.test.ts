import { describe, expect, it } from "vitest";
import bankText from "../../content/kerdesbank.hu.yaml?raw";
import devicesText from "../../content/eszkozok.yaml?raw";
import { ICON_KEYS } from "../ui/iconKeys.ts";
import { MINI_BANK_YAML, MINI_DEVICES_YAML } from "./__fixtures__/mini.ts";
import { parseContent } from "./validate.ts";

function issuesFor(bank: string, devices = MINI_DEVICES_YAML) {
  const r = parseContent(bank, devices);
  return r.ok ? [] : r.issues;
}
const msgs = (bank: string, devices?: string) => issuesFor(bank, devices).map((i) => `${i.path}: ${i.message}`);

describe("real content files", () => {
  it("validate without errors", () => {
    const r = parseContent(bankText, devicesText, { knownIcons: ICON_KEYS });
    expect(r.ok ? [] : r.issues).toEqual([]);
  });
});

describe("parseContent", () => {
  it("accepts the fixture", () => {
    expect(parseContent(MINI_BANK_YAML, MINI_DEVICES_YAML).ok).toBe(true);
  });

  it("applies defaults: skip, skipLabel and the scale labels", () => {
    const r = parseContent(MINI_BANK_YAML, MINI_DEVICES_YAML);
    if (!r.ok) throw new Error("invalid");
    const byId = new Map(r.bank.cards.map((c) => [c.id, c]));
    expect(byId.get("Q_TOWN")).toMatchObject({ skip: false });
    expect(byId.get("Q_HEAT")).toMatchObject({ skip: true, skipLabel: "Kihagyom" });
    expect(byId.get("N01")).toMatchObject({ skip: false });
    expect(r.bank.defaultScale.labels[2]).toBe("három");
  });

  it("resolves YAML anchors, aliases and merge keys", () => {
    const withAlias = MINI_BANK_YAML.replace(
      `    scale: { left: "Biztosan nem", right: "Biztosan igen" }`,
      `    scale: &sk { left: "Biztosan nem", right: "Biztosan igen" }`,
    ).replace(`text: "Szöveg 2" }`, `text: "Szöveg 2", scale: *sk }`);
    expect(withAlias).toContain("*sk");
    const r = parseContent(withAlias, MINI_DEVICES_YAML);
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect((r.bank.cards.find((c) => c.id === "W2") as { scale?: { left?: string } }).scale?.left).toBe("Biztosan nem");
  });

  it("reports YAML syntax errors", () => {
    expect(msgs("cards: [unclosed")[0]).toMatch(/\(YAML\)/);
  });

  it("reports schema errors with the card id in the path", () => {
    const bad = MINI_BANK_YAML.replace(`{ id: W2, block: why, type: scale6,`, `{ id: W2, block: why, type: scale7,`);
    expect(msgs(bad).join("\n")).toMatch(/cards\[\d+\] \(W2\)\.type.*Ismeretlen kártyatípus/);
    const typo = MINI_BANK_YAML.replace(`text: "Szöveg 2" }`, `text: "Szöveg 2", skpi: true }`);
    expect(msgs(typo).join("\n")).toMatch(/\(W2\)/);
  });

  it("requires unique card ids and existing blocks", () => {
    expect(msgs(MINI_BANK_YAML.replace("id: W2,", "id: W1,")).join("\n")).toMatch(/nem egyedi/);
    expect(msgs(MINI_BANK_YAML.replace("{ id: W2, block: why", "{ id: W2, block: nincs")).join("\n")).toMatch(/Ismeretlen blokk/);
  });

  it("rejects answer references to missing cards or cards that do not come earlier", () => {
    const missing = MINI_BANK_YAML.replace("in: [pump] }", "in: [pump] }").replace("answer: Q_HEAT", "answer: NINCS");
    expect(msgs(missing).join("\n")).toMatch(/nem létező kártyára hivatkozik: „NINCS”/);
    const forward = MINI_BANK_YAML.replace(
      `{ id: Q_UP, block: devs, type: yesno, text: "Használja fűtésre?", showIf: { owns: app_b2 } }`,
      `{ id: Q_UP, block: devs, type: yesno, text: "Használja fűtésre?", showIf: { answer: Q_MULTI, in: [ar] } }`,
    );
    expect(msgs(forward).join("\n")).toMatch(/nem előzi meg/);
  });

  it("rejects references into the card's own randomize group", () => {
    const bad = MINI_BANK_YAML.replace(
      `{ id: W3, block: why, type: scale6, randomizeGroup: g,`,
      `{ id: W3, block: why, type: scale6, randomizeGroup: g, showIf: { answer: W2, gte: 3 },`,
    );
    expect(msgs(bad).join("\n")).toMatch(/nem előzi meg/);
  });

  it("checks owns ids against the appliances and module ids against the modules", () => {
    expect(msgs(MINI_BANK_YAML.replace("owns: app_b2", "owns: nincs_ilyen")).join("\n")).toMatch(/Ismeretlen eszköz-azonosító.*nincs_ilyen/);
    expect(msgs(MINI_BANK_YAML.replace("module: m_c, priority: 1", "module: m_x, priority: 1")).join("\n")).toMatch(/Ismeretlen modul.*m_x/);
  });

  it("checks tierUpgrade.when references (existence and order)", () => {
    const missing = MINI_DEVICES_YAML.replace("answer: Q_UP", "answer: NINCS");
    expect(msgs(MINI_BANK_YAML, missing).join("\n")).toMatch(/modules\[\d+\] \(m_b2\)\.tierUpgrade\.when.*NINCS/);
    const late = MINI_DEVICES_YAML.replace("answer: Q_UP, in: [igen]", "answer: Z01, answered: true");
    expect(msgs(MINI_BANK_YAML, late).join("\n")).toMatch(/nem előzi meg a modul első kártyáját/);
    const anyForm = MINI_DEVICES_YAML.replace(
      "when: { answer: Q_UP, in: [igen] }",
      "when: { any: [ { answer: Q_UP, in: [igen] }, { answer: Q_HEAT, in: [pump] } ] }",
    );
    expect(msgs(MINI_BANK_YAML, anyForm)).toEqual([]);
  });

  it("checks appliances of modules and the picker options", () => {
    expect(msgs(MINI_BANK_YAML, MINI_DEVICES_YAML.replace("appliances: [app_a2]", "appliances: [app_zz]")).join("\n")).toMatch(/app_zz/);
    expect(msgs(MINI_BANK_YAML.replace("{ value: app_c2, label", "{ value: app_q, label")).join("\n")).toMatch(/nem eszköz-azonosító/);
  });

  it("warns about unknown icon keys without failing", () => {
    const r = parseContent(MINI_BANK_YAML.replace("icon: nincs }\n    exclusive: [none]", "icon: ismeretlen }\n    exclusive: [none]"), MINI_DEVICES_YAML, {
      knownIcons: ICON_KEYS,
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.message).join()).toMatch(/ismeretlen/);
  });
});

describe("effort validation", () => {
  it("accepts any ascending subset of the known levels and rejects repeats or a wrong order", () => {
    const row = /^  - \{ id: rovid,.*\n/m;
    expect(issuesFor(bankText.replace(row, ""), devicesText)).toEqual([]);
    expect(issuesFor(bankText.replace(row, (line) => line.replace("rovid", "alapos")), devicesText).map((issue) => issue.path))
      .toContain("effortLevels[1].id");
    expect(issuesFor(bankText.replace(row, (line) => line.replace("rovid", "kozepes").replace("Rövidített", "Közepes")), devicesText)
      .map((issue) => issue.path)).toEqual([]);
    expect(issuesFor(bankText.replace(/^effortLevels:\n/m, "effortLevels: []\n").replace(/^  - \{ id: (rovid|alapos),.*\n/gm, ""), devicesText)
      .map((issue) => issue.path)).toContain("effortLevels");
  });

  it("rejects references to higher-effort cards in card, option, and module conditions", () => {
    const highEffort = MINI_BANK_YAML
      .replace("    skip: false\n    text: \"Település?\"", "    effort: 3\n    skip: false\n    text: \"Település?\"")
      .replace("{ id: Q_UP, block: devs, type: yesno,", "{ id: Q_UP, block: devs, type: yesno, effort: 2,");
    expect(msgs(highEffort)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\(Q_MULTI\)\.options\[3\]\.showIf.*Q_TOWN.*effort/),
      expect.stringMatching(/\(W1\)\.textVariants\[0\]\.when.*Q_TOWN.*effort/),
      expect.stringMatching(/\(M_A1_3\)\.showIf.*Q_TOWN.*effort/),
      expect.stringMatching(/\(m_b2\)\.tierUpgrade\.when.*Q_UP.*effort/),
    ]));
  });

  it("requires uniform effort for each randomized group", () => {
    const mixed = MINI_BANK_YAML.replace("{ id: W2, block: why,", "{ id: W2, block: why, effort: 2,");
    expect(msgs(mixed)).toEqual(expect.arrayContaining([expect.stringMatching(/randomizeGroup „g”.*azonos effort/)]));
  });

  it.each(["N01", "N02", "Z01"])("requires effort 1 on %s", (id) => {
    const invalid = bankText.replace(`  - id: ${id}\n`, `  - id: ${id}\n    effort: 2\n`);
    expect(msgs(invalid, devicesText)).toEqual(expect.arrayContaining([
      expect.stringMatching(new RegExp(`\\(${id}\\)\\.effort.*kötelező értéke 1`)),
    ]));
  });
});
