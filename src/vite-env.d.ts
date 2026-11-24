/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module "virtual:survey-content" {
  const survey: import("./content/survey.ts").SurveyContent;
  export default survey;
}

declare module "*.yaml?raw" {
  const content: string;
  export default content;
}
