// Parse + validate the content files: YAML -> zod schema -> cross-reference checks.
// Node-importable (no Vite-only imports), so scripts/validate-content.ts can use it.
import { parse } from "yaml";
import { z } from "zod";
import { checkConditionShape, collectRefs } from "./conditions.ts";
import { buildDeck } from "./deck.ts";
import { EFFORT_LEVEL_IDS } from "./effort.ts";
import { bankSchema, devicesSchema, resolveBank, isAnswerable, type Bank, type Card, type Devices } from "./schema.ts";
import type { Condition } from "./types.ts";

export type ContentFile = "kerdesbank.hu.yaml" | "eszkozok.yaml";
export interface Issue {
  file: ContentFile;
  path: string;
  message: string;
}
export type ContentResult =
  | { ok: true; bank: Bank; devices: Devices; warnings: Issue[] }
  | { ok: false; issues: Issue[]; warnings: Issue[] };

function formatPath(path: PropertyKey[], data: unknown): string {
  let out = "";
  let node: unknown = data;
  path.forEach((seg, i) => {
    out += typeof seg === "number" ? `[${seg}]` : out ? `.${String(seg)}` : String(seg);
    node = (node as Record<PropertyKey, unknown> | undefined)?.[seg];
    const id = (node as { id?: unknown } | undefined)?.id;
    if (typeof seg === "number" && i === 1 && typeof id === "string") out += ` (${id})`;
  });
  return out || "(gyökér)";
}

function zodIssues(file: ContentFile, error: z.ZodError, data: unknown): Issue[] {
  return error.issues.map((i) => {
    const isType = i.code === "invalid_union" && i.path[i.path.length - 1] === "type";
    return {
      file,
      path: formatPath(i.path, data),
      message: isType
        ? "Ismeretlen kártyatípus. Lehetséges: info, consent, single, multi_tiles, yesno, scale6, timeline, free_text, summary_highlight."
        : i.message,
    };
  });
}

function parseYaml(file: ContentFile, text: string): { data?: unknown; issues: Issue[] } {
  try {
    // `merge` also resolves YAML 1.1 merge keys (<<: *anchor); anchors and aliases work by default.
    return { data: parse(text, { merge: true }), issues: [] };
  } catch (e) {
    return { issues: [{ file, path: "(YAML)", message: e instanceof Error ? e.message : String(e) }] };
  }
}

export interface ParseOptions {
  /** Semantic icon keys the UI can draw; unknown keys only produce warnings. */
  knownIcons?: readonly string[];
}

export function parseContent(bankText: string, devicesText: string, opts: ParseOptions = {}): ContentResult {
  const issues: Issue[] = [];
  const bankY = parseYaml("kerdesbank.hu.yaml", bankText);
  const devY = parseYaml("eszkozok.yaml", devicesText);
  issues.push(...bankY.issues, ...devY.issues);
  const bankP = bankY.data === undefined ? undefined : bankSchema.safeParse(bankY.data);
  const devP = devY.data === undefined ? undefined : devicesSchema.safeParse(devY.data);
  if (bankP && !bankP.success) issues.push(...zodIssues("kerdesbank.hu.yaml", bankP.error, bankY.data));
  if (devP && !devP.success) issues.push(...zodIssues("eszkozok.yaml", devP.error, devY.data));
  if (!bankP?.success || !devP?.success) return { ok: false, issues, warnings: [] };

  const bank = resolveBank(bankP.data);
  const devices = devP.data;
  const warnings: Issue[] = [];
  issues.push(...checkDevices(devices));
  issues.push(...checkBank(bank, devices, warnings, opts.knownIcons));
  return issues.length ? { ok: false, issues, warnings } : { ok: true, bank, devices, warnings };
}

function checkDevices(d: Devices): Issue[] {
  const out: Issue[] = [];
  const add = (path: string, message: string) => out.push({ file: "eszkozok.yaml", path, message });
  const applianceIds = new Set<string>();
  d.appliances.forEach((a, i) => {
    if (applianceIds.has(a.id)) add(`appliances[${i}] (${a.id})`, "Az eszköz azonosítója nem egyedi.");
    applianceIds.add(a.id);
  });
  const moduleIds = new Set<string>();
  d.modules.forEach((m, i) => {
    const p = `modules[${i}] (${m.id})`;
    if (moduleIds.has(m.id)) add(p, "A modul azonosítója nem egyedi.");
    moduleIds.add(m.id);
    m.appliances.forEach((a) => {
      if (!applianceIds.has(a)) add(`${p}.appliances`, `Ismeretlen eszköz-azonosító: „${a}”.`);
    });
  });
  for (const t of ["A", "B", "C"] as const)
    if (d.tierFloors[t] > d.tierCaps[t]) add(`tierFloors.${t}`, `A padló (${d.tierFloors[t]}) nagyobb, mint a keret (${d.tierCaps[t]}).`);
  return out;
}

function checkBank(bank: Bank, devices: Devices, warnings: Issue[], knownIcons?: readonly string[]): Issue[] {
  const out: Issue[] = [];
  const add = (path: string, message: string) => out.push({ file: "kerdesbank.hu.yaml", path, message });
  const warn = (path: string, message: string) => warnings.push({ file: "kerdesbank.hu.yaml", path, message });
  const where = (c: Card, i: number) => `cards[${i}] (${c.id})`;

  const blockIds = new Set<string>();
  bank.blocks.forEach((b, i) => {
    if (blockIds.has(b.id)) add(`blocks[${i}] (${b.id})`, "A blokk azonosítója nem egyedi.");
    blockIds.add(b.id);
  });
  const ids = new Map<string, number>();
  bank.cards.forEach((c, i) => {
    if (ids.has(c.id)) add(where(c, i), `A kártya azonosítója nem egyedi (először a cards[${ids.get(c.id)}] használja).`);
    else ids.set(c.id, i);
    if (!blockIds.has(c.block)) add(`${where(c, i)}.block`, `Ismeretlen blokk: „${c.block}”.`);
  });
  const cardById = new Map(bank.cards.map((c) => [c.id, c]));
  const applianceIds = new Set(devices.appliances.map((a) => a.id));
  const moduleIds = new Set(devices.modules.map((m) => m.id));
  bank.effortLevels?.forEach((level, i) => {
    if (level.id !== EFFORT_LEVEL_IDS[i])
      add(`effortLevels[${i}].id`, `A kitöltési hossz azonosítója itt „${EFFORT_LEVEL_IDS[i]}” kell legyen.`);
  });

  // Positions in the deck. A card in a randomizeGroup may land anywhere between the group's first and last slot.
  const deck = buildDeck(bank, devices, "validate").order;
  if (bank.effortLevels && cardById.get(deck[0])?.type !== "info")
    add("effortLevels", "A kitöltési hossz kiválasztásához az első kártya típusa legyen info.");
  const pos = new Map(deck.map((id, i) => [id, i]));
  const span = new Map<string, [number, number]>();
  const groupSpan = new Map<string, [number, number]>();
  for (const c of bank.cards) {
    const p = pos.get(c.id);
    if (p === undefined || !c.randomizeGroup) continue;
    const key = `${c.block}|${c.randomizeGroup}`;
    const g = groupSpan.get(key);
    groupSpan.set(key, g ? [Math.min(g[0], p), Math.max(g[1], p)] : [p, p]);
  }
  for (const c of bank.cards) {
    const p = pos.get(c.id) ?? -1;
    span.set(c.id, c.randomizeGroup ? (groupSpan.get(`${c.block}|${c.randomizeGroup}`) ?? [p, p]) : [p, p]);
  }
  const randomGroups = new Map<string, Card[]>();
  bank.cards.forEach((c) => {
    if (c.randomizeGroup) randomGroups.set(c.randomizeGroup, [...(randomGroups.get(c.randomizeGroup) ?? []), c]);
  });
  for (const [g, cards] of randomGroups) {
    const blocks = new Set(cards.map((c) => c.block));
    if (blocks.size > 1) add(`randomizeGroup „${g}”`, `A csoport több blokkban szerepel (${[...blocks].join(", ")}); egy csoport egy blokkon belül lehet.`);
    if (cards.some((c) => c.effort !== cards[0].effort))
      add(`randomizeGroup „${g}”`, "A csoport minden kártyájának azonos effort értéket kell megadni.");
  }

  const pickers = bank.cards.filter((c) => c.type === "multi_tiles" && c.devicePicker);
  if (pickers.length > 1) add("devicePicker", `Legfeljebb egy kártyán lehet devicePicker: true (most: ${pickers.map((c) => c.id).join(", ")}).`);
  const picker = pickers[0];

  function checkEffort(target: Card, dependent: Card, report: (message: string) => void) {
    if (target.effort > dependent.effort)
      report(`A hivatkozott „${target.id}” kártya effort értéke (${target.effort}) nagyobb, mint a(z) „${dependent.id}” kártyáé (${dependent.effort}).`);
  }

  const checkCondition = (cond: Condition | undefined, path: string, dependent: Card) => {
    if (cond === undefined) return;
    const shape = checkConditionShape(cond, path);
    shape.forEach((x) => add(x.path, x.message));
    if (shape.length) return;
    const refs = collectRefs(cond);
    for (const ref of refs.answers) {
      const target = cardById.get(ref);
      if (!target) {
        add(path, `A feltétel nem létező kártyára hivatkozik: „${ref}”.`);
        continue;
      }
      if (!isAnswerable(target)) add(path, `A(z) „${ref}” kártyának nincs válasza (${target.type}), nem hivatkozható.`);
      const late = span.get(ref)![1];
      const early = span.get(dependent.id)![0];
      if (late >= early) add(path, `A feltétel a(z) „${ref}” kártyára hivatkozik, de az nem előzi meg biztosan a kártyát (sorrend vagy véletlenített csoport miatt).`);
      checkEffort(target, dependent, (message) => add(path, message));
    }
    if (refs.owns.length > 0) {
      if (!picker) add(path, "Az „owns”/„ownsAny” feltételhez kell egy kártya devicePicker: true jelöléssel.");
      else {
        if (span.get(picker.id)![1] >= span.get(dependent.id)![0])
          add(path, `Az eszközválasztó kártya (${picker.id}) nem előzi meg a feltételt tartalmazó kártyát.`);
        checkEffort(picker, dependent, (message) => add(path, message));
      }
    }
    for (const o of refs.owns)
      if (!applianceIds.has(o)) add(path, `Ismeretlen eszköz-azonosító az eszkozok.yaml-ban: „${o}”.`);
  };

  bank.cards.forEach((c, i) => {
    const w = where(c, i);
    if (c.effort !== 1 && (!isAnswerable(c) || c.id === "N03"))
      add(`${w}.effort`, "Ezen a kártyán az effort kötelező értéke 1.");
    checkCondition(c.showIf, `${w}.showIf`, c);
    c.textVariants?.forEach((v, k) => checkCondition(v.when, `${w}.textVariants[${k}].when`, c));
    if (c.module !== undefined) {
      if (!moduleIds.has(c.module)) add(`${w}.module`, `Ismeretlen modul az eszkozok.yaml-ban: „${c.module}”.`);
      if (!isAnswerable(c)) add(`${w}.module`, "Info, consent és összegző kártya nem lehet modulkártya.");
    }
    if (c.type === "single" || c.type === "multi_tiles") {
      const seen = new Set<string>();
      c.options.forEach((o, k) => {
        const op = `${w}.options[${k}]`;
        if (seen.has(o.value)) add(`${op}.value`, `Az opció értéke nem egyedi: „${o.value}”.`);
        seen.add(o.value);
        checkCondition(o.showIf, `${op}.showIf`, c);
        if (o.impliedBy !== undefined && c.type !== "multi_tiles") add(`${op}.impliedBy`, "Az impliedBy csak multi_tiles kártyán használható.");
        else checkCondition(o.impliedBy, `${op}.impliedBy`, c);
        if (knownIcons && o.icon && !knownIcons.includes(o.icon)) warn(`${op}.icon`, `Ismeretlen ikonkulcs: „${o.icon}” (általános ikon jelenik meg).`);
      });
    }
    if (c.type === "multi_tiles") {
      const values = new Set(c.options.map((o) => o.value));
      c.exclusive?.forEach((v) => {
        if (!values.has(v)) add(`${w}.exclusive`, `Az exclusive érték nem szerepel az opciók között: „${v}”.`);
      });
      if (c.max !== undefined && c.max > c.options.length) add(`${w}.max`, "A max nagyobb, mint az opciók száma.");
      if (c.devicePicker) {
        const ex = new Set(c.exclusive ?? []);
        c.options.forEach((o, k) => {
          if (!ex.has(o.value) && !applianceIds.has(o.value))
            add(`${w}.options[${k}].value`, `Az eszközválasztó opciója nem eszköz-azonosító az eszkozok.yaml-ban (és nem exclusive): „${o.value}”.`);
        });
      }
    }
    if (c.type === "summary_highlight") {
      if (deck[deck.length - 1] !== c.id) add(w, "Az összegző kártyának a kérdőív legutolsó kártyájának kell lennie.");
      const t = new Set<string>();
      c.topics.forEach((x, k) => {
        if (t.has(x.id)) add(`${w}.topics[${k}]`, `A téma azonosítója nem egyedi: „${x.id}”.`);
        t.add(x.id);
      });
      if (c.max > c.topics.length) add(`${w}.max`, "A max nagyobb, mint a témák száma.");
    }
  });
  const count = (t: Card["type"]) => bank.cards.filter((c) => c.type === t);
  if (count("summary_highlight").length > 1) add("summary_highlight", "Legfeljebb egy összegző kártya lehet.");
  if (count("consent").length > 1) add("consent", "Legfeljebb egy consent kártya lehet.");
  if (bank.cards.some((c) => c.module !== undefined) && !picker)
    add("devicePicker", "Modulkártyák vannak, de nincs eszközválasztó kártya (devicePicker: true).");

  // tierUpgrade conditions: referenced cards must come before the module's first card.
  devices.modules.forEach((m, i) => {
    if (!m.tierUpgrade) return;
    const path = `modules[${i}] (${m.id}).tierUpgrade.when`;
    const cards = deck.map((id) => cardById.get(id)!).filter((c) => c.module === m.id);
    checkConditionForModule(m.tierUpgrade.when, path, cards);
  });
  return out;

  function checkConditionForModule(cond: Condition, path: string, cards: Card[]) {
    const shape = checkConditionShape(cond, path);
    shape.forEach((x) => out.push({ file: "eszkozok.yaml", path: x.path, message: x.message }));
    if (shape.length) return;
    const refs = collectRefs(cond);
    const push = (message: string) => out.push({ file: "eszkozok.yaml", path, message });
    const first = cards[0]?.id;
    for (const ref of refs.answers) {
      const target = cardById.get(ref);
      if (!target) push(`A feltétel nem létező kártyára hivatkozik: „${ref}”.`);
      else if (!isAnswerable(target)) push(`A(z) „${ref}” kártyának nincs válasza, nem hivatkozható.`);
      else {
        if (first !== undefined && span.get(ref)![1] >= span.get(first)![0])
          push(`A(z) „${ref}” kártya nem előzi meg a modul első kártyáját (${first}), ezért a szint nem dönthető el időben.`);
        cards.forEach((card) => checkEffort(target, card, push));
      }
    }
    if (refs.owns.length && picker) cards.forEach((card) => checkEffort(picker, card, push));
    for (const o of refs.owns) if (!applianceIds.has(o)) push(`Ismeretlen eszköz-azonosító: „${o}”.`);
  }
}
