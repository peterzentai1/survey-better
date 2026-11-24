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
  const display = { ...local.display, privacyNotice: "/adatkezeles" };
  const metrics = { display, storage: { ...local.storage, metrics: true } };
  const remote = { display, storage: { ...local.storage, mode: "supabase" as const, retentionUntil: "2028-02-29" } };
  expect(() => checkSurveyConsent([placeholder], local)).not.toThrow();
  for (const settings of [metrics, remote]) {
    expect(() => checkSurveyConsent([placeholder], settings)).toThrow(/N02/);
    expect(() => checkSurveyConsent([], settings)).toThrow(/N02/);
    expect(() => checkSurveyConsent([ready], settings)).not.toThrow();
    const noNotice = { ...settings, display: { ...settings.display, privacyNotice: null } };
    expect(() => checkSurveyConsent([ready], noNotice)).toThrow(/privacyNotice/);
  }
});

it("accepts only a same-site path or an https URL as the privacy notice", () => {
  const notice = (value: string) => parseSurveyManifest("survey_a", files + `\nsettings: { display: { privacyNotice: "${value}" } }`);
  expect(notice("/adatkezeles").settings.display.privacyNotice).toBe("/adatkezeles");
  expect(notice("https://example.org/adatkezeles").settings.display.privacyNotice).toBe("https://example.org/adatkezeles");
  for (const bad of ["javascript:alert(1)", "http://example.org", "adatkezeles", "//evil.example"]) {
    expect(() => notice(bad)).toThrow();
  }
});

it("ships a complete static privacy notice that matches N02", async () => {
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(`${process.cwd()}/public/adatkezeles.html`, "utf8");
  expect(html).not.toMatch(/\[[^\]]*\]/);
  for (const fact of ["Zentai Péter", "2027. december 1", "peterzentai1@gmail.com", "18 éven felülieknek", "Frankfurt"]) {
    expect(html).toContain(fact);
  }
});
