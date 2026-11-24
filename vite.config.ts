/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { DEFAULT_SURVEY } from "./src/content/survey.ts";
import { readSurvey } from "./scripts/read-survey.ts";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

function surveyContent(slug: string): Plugin {
  const id = "virtual:survey-content";
  const resolvedId = "\0" + id;
  return {
    name: "survey-content",
    resolveId: (source) => source === id ? resolvedId : undefined,
    load(source) {
      if (source !== resolvedId) return;
      const survey = readSurvey(slug, (path) => this.addWatchFile(path));
      if (!survey.ok) {
        this.error(survey.issues.map(({ file, path, message }) => `${file} ${path}: ${message}`).join("\n"));
      }
      return "export default JSON.parse(" + JSON.stringify(JSON.stringify(survey)) + ")";
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    surveyContent(command === "serve" && mode === "test"
      ? DEFAULT_SURVEY
      : loadEnv(mode, process.cwd(), "VITE_").VITE_SURVEY || DEFAULT_SURVEY),
    react(),
    tailwindcss(),
  ],
  build: { chunkSizeWarningLimit: 700 },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
}));
