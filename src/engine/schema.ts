// zod schemas for the question bank (kerdesbank.*.yaml) and the appliance file (eszkozok.yaml).
// The schema is documented by content/sample.yaml; changes go to SCHEMA_CHANGES.md first.
import { z } from "zod";
import type { Condition } from "./types.ts";

z.config(z.locales.hu());

// Conditions are checked structurally (with Hungarian messages) in validate.ts.
const condition = z.custom<Condition>((v) => typeof v === "object" && v !== null, {
  message: "A feltételnek objektumnak kell lennie.",
});

const text = z.string().min(1);
const stringValue = z.union([z.string(), z.number()]).transform(String);

const option = z.strictObject({
  value: stringValue,
  label: text,
  icon: z.string().optional(),
  impliedBy: condition.optional(),
  showIf: condition.optional(),
});

const scalePart = z.strictObject({
  left: z.string().optional(),
  right: z.string().optional(),
  labels: z.array(z.string()).length(6).optional(),
});

const common = {
  id: text,
  block: text,
  lead: z.string().optional(),
  help: z.string().optional(),
  skip: z.boolean().optional(),
  skipLabel: z.string().optional(),
  showIf: condition.optional(),
  textVariants: z.array(z.strictObject({ when: condition, text })).optional(),
  module: z.string().optional(),
  priority: z.number().optional(),
  randomizeGroup: z.string().optional(),
  source: z.string().optional(),
  reversed: z.boolean().optional(),
};

const topic = z.strictObject({ id: text, label: text, statements: z.array(text).optional() });

export const cardSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("info"), title: text, text, cta: text }),
  z.strictObject({
    ...common,
    type: z.literal("consent"),
    title: text,
    text,
    participationLabel: text,
    paradataLabel: text,
  }),
  z.strictObject({
    ...common,
    type: z.literal("single"),
    text,
    layout: z.enum(["list", "chips"]).optional(),
    options: z.array(option).min(2),
  }),
  z.strictObject({
    ...common,
    type: z.literal("multi_tiles"),
    text,
    options: z.array(option).min(2),
    devicePicker: z.boolean().optional(),
    exclusive: z.array(z.string()).optional(),
    max: z.number().int().positive().optional(),
  }),
  z.strictObject({
    ...common,
    type: z.literal("yesno"),
    text,
    yesLabel: z.string().optional(),
    noLabel: z.string().optional(),
  }),
  z.strictObject({ ...common, type: z.literal("scale6"), text, scale: scalePart.optional() }),
  z.strictObject({
    ...common,
    type: z.literal("timeline"),
    text,
    max: z.number().int().positive().max(24).optional(),
  }),
  z.strictObject({
    ...common,
    type: z.literal("free_text"),
    text,
    maxLength: z.number().int().positive(),
    privacyNote: z.string().optional(),
  }),
  z.strictObject({
    ...common,
    type: z.literal("summary_highlight"),
    text,
    max: z.number().int().positive(),
    maxLength: z.number().int().positive(),
    privacyNote: z.string().optional(),
    topics: z.array(topic).min(1),
  }),
]);

export const bankSchema = z.strictObject({
  version: text,
  locale: z.string().optional(),
  defaults: z
    .strictObject({
      skip: z.boolean().optional(),
      skipLabel: z.string().optional(),
      scale6: scalePart.optional(),
    })
    .optional(),
  blocks: z.array(z.strictObject({ id: text, title: text })).min(1),
  cards: z.array(cardSchema).min(1),
});

const tier = z.enum(["A", "B", "C"]);
const tierMap = z.strictObject({ A: z.number().int().min(0), B: z.number().int().min(0), C: z.number().int().min(0) });

export const devicesSchema = z.strictObject({
  version: text,
  tierCaps: tierMap,
  tierFloors: tierMap,
  globalModuleCap: z.number().int().min(0),
  appliances: z.array(z.strictObject({ id: text, label: text, icon: z.string().optional() })).min(1),
  modules: z
    .array(
      z.strictObject({
        id: text,
        tier,
        appliances: z.array(text).min(1),
        tierUpgrade: z.strictObject({ when: condition, tier }).optional(),
      }),
    )
    .min(1),
});

export type RawCard = z.infer<typeof cardSchema>;
export type CardType = RawCard["type"];
export type CardOption = z.infer<typeof option>;
export type Tier = z.infer<typeof tier>;
export type Devices = z.infer<typeof devicesSchema>;
export type Appliance = Devices["appliances"][number];
export type Module = Devices["modules"][number];
export type Topic = z.infer<typeof topic>;
export type RawBank = z.infer<typeof bankSchema>;

export interface Scale {
  left: string;
  right: string;
  labels: string[];
}

/** A card with the bank defaults applied. */
export type Card = RawCard & { skip: boolean; skipLabel: string };

export interface Bank {
  version: string;
  blocks: RawBank["blocks"];
  cards: Card[];
  defaultScale: Scale;
}

export const FALLBACK_SCALE: Scale = {
  left: "Egyáltalán nem",
  right: "Teljes mértékben",
  labels: ["Egyáltalán nem", "Nagyrészt nem", "Inkább nem", "Inkább igen", "Nagyrészt igen", "Teljes mértékben"],
};

/** Apply the `defaults` section: skip, skipLabel and the scale6 labels. */
export function resolveBank(raw: RawBank): Bank {
  const d = raw.defaults ?? {};
  const defaultScale: Scale = {
    left: d.scale6?.left ?? FALLBACK_SCALE.left,
    right: d.scale6?.right ?? FALLBACK_SCALE.right,
    labels: d.scale6?.labels ?? FALLBACK_SCALE.labels,
  };
  const noSkipTypes = new Set<CardType>(["info", "consent", "summary_highlight"]);
  const cards = raw.cards.map((c): Card => {
    const skip = noSkipTypes.has(c.type) ? false : (c.skip ?? d.skip ?? true);
    return { ...c, skip, skipLabel: c.skipLabel ?? d.skipLabel ?? "Nem tudom / kihagyom" };
  });
  return { version: raw.version, blocks: raw.blocks, cards, defaultScale };
}

/** The scale of a scale6 card: its own values over the bank defaults. */
export function scaleOf(card: Card, bank: Pick<Bank, "defaultScale">): Scale {
  const s = card.type === "scale6" ? card.scale : undefined;
  return {
    left: s?.left ?? bank.defaultScale.left,
    right: s?.right ?? bank.defaultScale.right,
    labels: s?.labels ?? bank.defaultScale.labels,
  };
}

/** Options a respondent can see right now (option-level showIf already applied by the caller). */
export function isAnswerable(card: Card): boolean {
  return card.type !== "info" && card.type !== "consent" && card.type !== "summary_highlight";
}
