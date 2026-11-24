// Vite resolves and validates only the selected survey at build time.
import survey from "virtual:survey-content";
import type { SurveyContent } from "./survey.ts";

export function loadContent(): SurveyContent {
  return survey;
}
