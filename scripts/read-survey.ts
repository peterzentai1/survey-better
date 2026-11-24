import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSurveyManifest, checkSurveyConsent, defaultSettings, SURVEY_SLUG, type SurveyContent } from "../src/content/survey.ts";
import { parseContent } from "../src/engine/validate.ts";
import { ICON_KEYS } from "../src/ui/iconKeys.ts";

export const contentRoot = realpathSync(fileURLToPath(new URL("../content/", import.meta.url)));

function contentPath(dir: string, file: string) {
  const path = realpathSync(resolve(dir, file));
  const name = relative(contentRoot, path);
  if (isAbsolute(file) || isAbsolute(name) || name === ".." || name.startsWith(".." + sep)) {
    throw new Error("A tartalomfájlnak a content/ mappán belül kell lennie: " + file);
  }
  return path;
}

export function readSurvey(slug: string, watch: (path: string) => void = () => {}): SurveyContent {
  let location = { file: "survey.yaml", path: "(gyökér)" };
  try {
    if (!SURVEY_SLUG.test(slug)) throw new Error("Érvénytelen kérdőív-azonosító: " + slug);
    const dir = resolve(contentRoot, "surveys", slug);
    watch(resolve(dir, "survey.yaml"));
    const manifest = parseSurveyManifest(slug, readFileSync(contentPath(dir, "survey.yaml"), "utf8"));
    const read = (name: string) => {
      location = { file: name, path: "(fájl)" };
      const path = contentPath(dir, name);
      watch(path);
      return readFileSync(path, "utf8");
    };
    const parsed = parseContent(read(manifest.bank), read(manifest.devices), {
      knownIcons: ICON_KEYS,
      files: [manifest.bank, manifest.devices],
    });
    if (parsed.ok) {
      location = { file: manifest.bank, path: "N02" };
      checkSurveyConsent(parsed.bank.cards, manifest.settings);
    }
    return { ...parsed, slug, settings: manifest.settings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, slug, settings: defaultSettings(slug), issues: [{ ...location, message }], warnings: [] };
  }
}
