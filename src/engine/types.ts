// Shared plain types for the engine. No runtime code, so it is safe to import anywhere.

export type Scalar = string | number;

/** Condition language, see the bottom of content/sample.yaml. */
export type AnswerCondition = {
  answer: string;
  in?: Scalar[];
  gte?: number;
  lte?: number;
  answered?: boolean;
  skipped?: boolean;
};
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { owns: string }
  | { ownsAny: string[] }
  | AnswerCondition;

export type ItemStatus = "not_shown" | "shown" | "answered" | "skipped";

/** A stored answer: single/yesno = string, scale6 = number, multi_tiles = string[], timeline = hours (number[]), free_text = string, consent = true. */
export type ItemValue = string | number | boolean | string[] | number[];

export interface ItemRecord {
  status: ItemStatus;
  value?: ItemValue;
  /** Index of the text variant shown (only when the card has textVariants and one matched). */
  variant?: number;
  /** Index in the presentation order at first show. */
  position?: number;
  /** How many times the stored answer was replaced after it was first given. */
  changes: number;
  /** Stored value kept, but the card is no longer on the respondent's path. */
  inactive?: true;
}

export interface Highlight {
  topic: string;
  statement?: string;
  text?: string;
}

export interface ParadataEntry {
  dwellMs: number;
  inputs: { tap: number; key: number; drag: number };
  backNavs: number;
}

export interface ResponseRecord {
  schema: "kartya-kerdoiv-response/0.1";
  sessionId: string;
  bankVersion: string;
  weightsVersion: string;
  appVersion: string;
  startedDate: string;
  completed: boolean;
  consent: { participation: boolean; paradata: boolean };
  items: Record<string, ItemRecord>;
  order: string[];
  randomization: Record<string, string[]>;
  quotas: Record<string, number>;
  highlights: Highlight[];
  paradata?: Record<string, ParadataEntry>;
}
