// Own fixtures for engine and UI tests, independent of the real content files.
// They exercise every card type and every feature of the condition language.
import { parseContent } from "../validate.ts";

export const MINI_DEVICES_YAML = `
version: "wtest"
tierCaps: { A: 4, B: 2, C: 1 }
tierFloors: { A: 2, B: 1, C: 0 }
globalModuleCap: 20
appliances:
  - { id: app_a1, label: "A1 eszköz", icon: bojler }
  - { id: app_a2, label: "A2 eszköz", icon: auto }
  - { id: app_b1, label: "B1 eszköz", icon: klima }
  - { id: app_b2, label: "B2 eszköz", icon: napelem }
  - { id: app_c1, label: "C1 eszköz", icon: mosogep }
  - { id: app_c2, label: "C2 eszköz", icon: szarito }
modules:
  - { id: m_a1, tier: A, appliances: [app_a1] }
  - { id: m_a2, tier: A, appliances: [app_a2] }
  - { id: m_b1, tier: B, appliances: [app_b1] }
  - id: m_b2
    tier: B
    appliances: [app_b2]
    tierUpgrade: { when: { answer: Q_UP, in: [igen] }, tier: A }
  - { id: m_c, tier: C, appliances: [app_c1, app_c2] }
`;

export const MINI_BANK_YAML = `
version: "0.0.1-test"
locale: hu
defaults:
  skip: true
  skipLabel: "Kihagyom"
  scale6:
    left: "Egyáltalán nem"
    right: "Teljes mértékben"
    labels: ["egy", "kettő", "három", "négy", "öt", "hat"]
blocks:
  - { id: start, title: "Kezdés" }
  - { id: base, title: "Alapok" }
  - { id: devs, title: "Eszközök" }
  - { id: why, title: "Indokok" }
  - { id: mods, title: "Modulok" }
  - { id: end, title: "Zárás" }
cards:
  - { id: N01, block: start, type: info, title: "Üdvözöljük", text: "Szöveg", cta: "Kezdjük" }
  - id: N02
    block: start
    type: consent
    title: "Tájékoztatás"
    text: "Hozzájárulás"
    participationLabel: "Részt veszek"
    paradataLabel: "Technikai adatok is mehetnek"
  - id: Q_TOWN
    block: base
    type: single
    skip: false
    text: "Település?"
    options:
      - { value: x, label: "X város" }
      - { value: y, label: "Y falu" }
  - id: Q_HEAT
    block: base
    type: single
    layout: chips
    text: "Fűtés?"
    options:
      - { value: gas, label: "Gáz" }
      - { value: pump, label: "Hőszivattyú" }
  - id: E01
    block: devs
    type: multi_tiles
    devicePicker: true
    text: "Mi van otthon?"
    options:
      - { value: app_a1, label: "A1", icon: bojler, impliedBy: { answer: Q_HEAT, in: [pump] } }
      - { value: app_a2, label: "A2", icon: auto }
      - { value: app_b1, label: "B1", icon: klima }
      - { value: app_b2, label: "B2", icon: napelem }
      - { value: app_c1, label: "C1", icon: mosogep }
      - { value: app_c2, label: "C2", icon: szarito }
      - { value: none, label: "Egyik sem", icon: nincs }
    exclusive: [none]
  - { id: Q_UP, block: devs, type: yesno, text: "Használja fűtésre?", showIf: { owns: app_b2 } }
  - id: Q_MULTI
    block: devs
    type: multi_tiles
    max: 2
    text: "Mi a fontos?"
    options:
      - { value: ar, label: "Ár" }
      - { value: komfort, label: "Komfort" }
      - { value: kornyezet, label: "Környezet" }
      - { value: titkos, label: "Rejtett", showIf: { answer: Q_TOWN, in: [y] } }
      - { value: semmi, label: "Semmi", icon: nincs }
    exclusive: [semmi]
  - id: W1
    block: why
    type: scale6
    randomizeGroup: g
    lead: "Bevezető"
    text: "Általános szöveg 1"
    textVariants:
      - { when: { answer: Q_TOWN, in: [x] }, text: "Városi szöveg 1" }
    scale: { left: "Biztosan nem", right: "Biztosan igen" }
  - { id: W2, block: why, type: scale6, randomizeGroup: g, text: "Szöveg 2" }
  - { id: W3, block: why, type: scale6, randomizeGroup: g, text: "Szöveg 3" }
  - { id: W4, block: why, type: scale6, randomizeGroup: g, text: "Szöveg 4" }
  - { id: W5, block: why, type: timeline, max: 3, text: "Mely órákban?" }
  - { id: M_B2_1, block: mods, type: single, module: m_b2, priority: 1, text: "B2 modul 1", options: [ { value: a, label: "a" }, { value: b, label: "b" } ] }
  - { id: M_A1_2, block: mods, type: yesno, module: m_a1, priority: 2, text: "A1 modul 2" }
  - { id: M_A1_1, block: mods, type: yesno, module: m_a1, priority: 1, text: "A1 modul 1" }
  - { id: M_A1_3, block: mods, type: yesno, module: m_a1, priority: 3, text: "A1 modul 3", showIf: { answer: Q_TOWN, in: [y] } }
  - { id: M_A1_4, block: mods, type: yesno, module: m_a1, priority: 4, text: "A1 modul 4" }
  - { id: M_A1_5, block: mods, type: yesno, module: m_a1, priority: 5, text: "A1 modul 5" }
  - { id: M_A2_1, block: mods, type: yesno, module: m_a2, priority: 1, text: "A2 modul 1" }
  - { id: M_B1_1, block: mods, type: yesno, module: m_b1, priority: 1, text: "B1 modul 1" }
  - { id: M_B1_2, block: mods, type: yesno, module: m_b1, priority: 2, text: "B1 modul 2" }
  - { id: M_B1_3, block: mods, type: yesno, module: m_b1, priority: 3, text: "B1 modul 3" }
  - { id: M_C_1, block: mods, type: yesno, module: m_c, priority: 1, text: "C modul 1" }
  - { id: M_C_2, block: mods, type: yesno, module: m_c, priority: 2, text: "C modul 2" }
  - id: Z01
    block: end
    type: free_text
    text: "Egyéb?"
    maxLength: 50
    privacyNote: "Ne írjon személyes adatot."
  - id: Z02
    block: end
    type: summary_highlight
    text: "Mi fontos?"
    max: 2
    maxLength: 40
    privacyNote: "Ne írjon személyes adatot."
    topics:
      - { id: t1, label: "Első téma", statements: ["Állítás A", "Állítás B"] }
      - { id: t2, label: "Második téma", statements: ["Állítás C"] }
`;

export function loadMini(devicesYaml = MINI_DEVICES_YAML, bankYaml = MINI_BANK_YAML) {
  const r = parseContent(bankYaml, devicesYaml);
  if (!r.ok) throw new Error("fixture invalid: " + JSON.stringify(r.issues, null, 2));
  return { bank: r.bank, devices: r.devices };
}
