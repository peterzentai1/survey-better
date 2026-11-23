// The questionnaire content shipped with the app: raw YAML text imported by Vite, parsed and validated at start-up.
import bankText from "../../content/kerdesbank.hu.yaml?raw";
import devicesText from "../../content/eszkozok.yaml?raw";
import { parseContent, type ContentResult } from "../engine/validate.ts";
import { ICON_KEYS } from "../ui/iconKeys.ts";

export function loadContent(): ContentResult {
  return parseContent(bankText, devicesText, { knownIcons: ICON_KEYS });
}
