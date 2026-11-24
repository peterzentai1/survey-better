// A dedicated stream keeps experimental assignment independent of question order.
import { hashString, mulberry32 } from "./prng.ts";

export const REACTION_CARD = "I10";
export const APPRAISAL_CARD = "I12";
export type InputMethod = "tap" | "drag" | "key";

export function temperatureArm(sessionId: string): "tap" | "drag" {
  return mulberry32(hashString(sessionId + "|temperature-v1"))() < 0.5 ? "tap" : "drag";
}
