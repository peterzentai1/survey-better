import { expect, it } from "vitest";
import { DEFAULT_SURVEY, checkSurveyConsent, defaultSettings, parseSurveyManifest } from "./survey.ts";
import { loadContent } from "./load.ts";

const files = "bank: bank.yaml\ndevices: devices.yaml";

it("applies survey defaults and accepts only the matching partition name", () => {
  expect(parseSurveyManifest("survey_a", files).settings).toEqual(defaultSettings("survey_a"));
  expect(defaultSettings().display).toMatchObject({ defaultEffort: "kozepes", scaleInput: "buttons" });
  expect(() => parseSurveyManifest("../a", files)).toThrow(/azonosító/);
  expect(() => parseSurveyManifest("survey_a", files + "\nsettings: { storage: { table: responses_other } }")).toThrow(/responses_survey_a/);
});

it("requires a concrete retention date for Supabase", () => {
  expect(() => parseSurveyManifest("survey_a", files + "\nsettings: { storage: { mode: supabase } }")).toThrow(/retentionUntil/);
  expect(() => parseSurveyManifest("survey_a", files + "\nsettings: { storage: { mode: supabase, retentionUntil: 2028-02-30 } }")).toThrow();
  expect(parseSurveyManifest("survey_a", files + "\nsettings: { storage: { mode: supabase, retentionUntil: 2028-02-29 } }")
    .settings.storage.retentionUntil).toBe("2028-02-29");
});

it("blocks all server writes until N02 is complete", () => {
  const content = loadContent();
  if (!content.ok) throw new Error("Invalid survey");
  expect(content.slug).toBe(DEFAULT_SURVEY);
  const local = content.settings;
  expect(() => checkSurveyConsent(content.bank.cards, local)).not.toThrow();
  expect(() => checkSurveyConsent(content.bank.cards, { ...local, storage: { ...local.storage, metrics: true } })).toThrow(/N02/);
  const remote = { ...local, storage: { ...local.storage, mode: "supabase" as const, retentionUntil: "2028-02-29" } };
  expect(() => checkSurveyConsent(content.bank.cards, remote)).toThrow(/N02/);
  expect(() => checkSurveyConsent(content.bank.cards.filter((c) => c.id !== "N02"), remote)).toThrow(/N02/);

  const ready = content.bank.cards.map((card) => card.type === "consent" ? {
    ...card, text: "Szintetikus tájékoztató integrációs teszthez.",
  } : card);
  expect(() => checkSurveyConsent(ready, remote)).not.toThrow();
});
