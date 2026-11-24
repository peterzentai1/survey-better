import { expect, it } from "vitest";
import { checkSurveyConsent, defaultSettings, parseSurveyManifest } from "./survey.ts";
import type { Card } from "../engine/schema.ts";

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
  const local = defaultSettings();
  const ready = {
    id: "N02", block: "N", type: "consent",
    skip: false, skipLabel: "Kihagyom", effort: 1,
    title: "Részvétel", text: "Szintetikus tájékoztató.",
    participationLabel: "Részt veszek", paradataLabel: "Engedélyezem a mérést",
  } satisfies Card;
  const placeholder = { ...ready, text: "Adatkezelő [HELYŐRZŐ]" };
  const metrics = { ...local, storage: { ...local.storage, metrics: true } };
  const remote = { ...local, storage: { ...local.storage, mode: "supabase" as const, retentionUntil: "2028-02-29" } };
  expect(() => checkSurveyConsent([placeholder], local)).not.toThrow();
  for (const settings of [metrics, remote]) {
    expect(() => checkSurveyConsent([placeholder], settings)).toThrow(/N02/);
    expect(() => checkSurveyConsent([], settings)).toThrow(/N02/);
    expect(() => checkSurveyConsent([ready], settings)).not.toThrow();
  }
});
