import { parse } from "yaml";
import { z } from "zod";
import { DEFAULT_EFFORT_LEVEL, EFFORT_LEVEL_IDS } from "../engine/effort.ts";
import type { Card } from "../engine/schema.ts";
import type { ContentResult } from "../engine/validate.ts";

export const DEFAULT_SURVEY = "haztartasi_rugalmassag";
export const SURVEY_SLUG = /^[a-z0-9_]{3,40}$/;
export const SOURCE_LINK = "https://github.com/peterzentai1/survey-better";

const displaySchema = z.strictObject({
  effortSelector: z.boolean().default(true),
  defaultEffort: z.enum(EFFORT_LEVEL_IDS).default(DEFAULT_EFFORT_LEVEL),
  showMedianTimes: z.boolean().default(true),
  banner: z.string().trim().min(1).nullable().default(null),
  scaleInput: z.enum(["buttons", "drag_reveal", "ab_test"]).default("buttons"),
  sourceLink: z.url({ protocol: /^https?$/ }).default(SOURCE_LINK),
});

const storageSchema = z.strictObject({
  mode: z.enum(["device", "supabase"]).default("device"),
  table: z.string().optional(),
  paradata: z.boolean().default(true),
  metrics: z.boolean().default(false),
  retentionUntil: z.iso.date().nullable().default(null),
  acceptingResponses: z.boolean().default(true),
});

export type DisplaySettings = z.output<typeof displaySchema>;
export type StorageSettings = Omit<z.output<typeof storageSchema>, "table"> & { table: string };
export type SurveySettings = { display: DisplaySettings; storage: StorageSettings };
export type SurveyContent = ContentResult & { slug: string; settings: SurveySettings };

function responseTable(slug: string) {
  return "responses_" + slug;
}

export function defaultSettings(slug = DEFAULT_SURVEY): SurveySettings {
  return { display: displaySchema.parse({}), storage: { ...storageSchema.parse({}), table: responseTable(slug) } };
}

const manifest = z.strictObject({
  bank: z.string().min(1),
  devices: z.string().min(1),
  settings: z.strictObject({
    display: displaySchema.prefault({}),
    storage: storageSchema.prefault({}),
  }).prefault({}),
});

export function parseSurveyManifest(slug: string, text: string) {
  if (!SURVEY_SLUG.test(slug)) throw new Error("Érvénytelen kérdőív-azonosító: " + slug);
  const { bank, devices, settings } = manifest.parse(parse(text) ?? {});
  const table = responseTable(slug);
  if (settings.storage.table !== undefined && settings.storage.table !== table) {
    throw new Error("A settings.storage.table értéke legyen " + table);
  }
  if (settings.storage.mode === "supabase" && settings.storage.retentionUntil === null) {
    throw new Error("A Supabase-tároláshoz meg kell adni a settings.storage.retentionUntil dátumot.");
  }
  return { bank, devices, settings: { ...settings, storage: { ...settings.storage, table } } };
}

export function checkSurveyConsent(cards: readonly Card[], settings: SurveySettings) {
  const consent = cards.find((card) => card.id === "N02");
  const ready = consent?.type === "consent" &&
    ![consent.title, consent.text, consent.participationLabel, consent.paradataLabel,
      ...(consent.textVariants?.map(({ text }) => text) ?? [])].some((s) => s.includes("["));
  if (!ready && (settings.storage.mode === "supabase" || settings.storage.metrics)) {
    throw new Error("Szerveres adatgyűjtéshez az N02 hozzájárulási kártyát helyőrzők nélkül kell megadni.");
  }
}

export function acceptingResponses(storage: StorageSettings, now = new Date()) {
  return storage.acceptingResponses &&
    (storage.retentionUntil === null || now.toISOString().slice(0, 10) <= storage.retentionUntil);
}
