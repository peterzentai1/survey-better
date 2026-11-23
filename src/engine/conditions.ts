// Condition evaluator and static checks for the condition language.
import type { AnswerCondition, Condition, ItemStatus, ItemValue } from "./types.ts";

/** What the evaluator may see: answers of cards on the respondent's path, and the owned appliances. */
export interface AnswerView {
  item(id: string): { status: ItemStatus; value?: ItemValue } | undefined;
  owns(applianceId: string): boolean;
}

function valueMatches(value: ItemValue | undefined, wanted: (string | number)[]): boolean {
  if (value === undefined) return false;
  const set = new Set(wanted.map(String));
  if (Array.isArray(value)) return (value as (string | number)[]).some((v) => set.has(String(v)));
  return set.has(String(value));
}

function numeric(value: ItemValue | undefined): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function evalAnswer(c: AnswerCondition, view: AnswerView): boolean {
  const it = view.item(c.answer);
  const answered = it?.status === "answered";
  const skipped = it?.status === "skipped";
  if (c.answered !== undefined && c.answered !== answered) return false;
  if (c.skipped !== undefined && c.skipped !== skipped) return false;
  const needsValue = c.in !== undefined || c.gte !== undefined || c.lte !== undefined;
  if (!needsValue) return true;
  // A card that was not shown or was skipped makes in/gte/lte false.
  if (!answered) return false;
  if (c.in !== undefined && !valueMatches(it?.value, c.in)) return false;
  if (c.gte !== undefined || c.lte !== undefined) {
    const n = numeric(it?.value);
    if (n === null) return false;
    if (c.gte !== undefined && !(n >= c.gte)) return false;
    if (c.lte !== undefined && !(n <= c.lte)) return false;
  }
  return true;
}

export function evaluate(c: Condition | undefined, view: AnswerView): boolean {
  if (c === undefined) return true;
  if ("all" in c) return c.all.every((x) => evaluate(x, view));
  if ("any" in c) return c.any.some((x) => evaluate(x, view));
  if ("not" in c) return !evaluate(c.not, view);
  if ("owns" in c) return view.owns(c.owns);
  if ("ownsAny" in c) return c.ownsAny.some((id) => view.owns(id));
  return evalAnswer(c, view);
}

/** Collect the card ids and appliance ids a condition refers to. */
export function collectRefs(c: Condition, out = { answers: [] as string[], owns: [] as string[] }) {
  if ("all" in c) c.all.forEach((x) => collectRefs(x, out));
  else if ("any" in c) c.any.forEach((x) => collectRefs(x, out));
  else if ("not" in c) collectRefs(c.not, out);
  else if ("owns" in c) out.owns.push(c.owns);
  else if ("ownsAny" in c) out.owns.push(...c.ownsAny);
  else out.answers.push(c.answer);
  return out;
}

/**
 * Structural check of an unknown value against the condition language.
 * Returns Hungarian messages keyed by a relative path; empty array = valid.
 */
export function checkConditionShape(c: unknown, path = ""): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const bad = (message: string, p = path) => issues.push({ path: p, message });
  if (typeof c !== "object" || c === null || Array.isArray(c)) {
    bad("A feltételnek objektumnak kell lennie.");
    return issues;
  }
  const o = c as Record<string, unknown>;
  const keys = Object.keys(o);
  const logic = keys.filter((k) => ["all", "any", "not", "owns", "ownsAny", "answer"].includes(k));
  if (logic.length !== 1) {
    bad(`A feltételben pontosan egy főkulcs lehet (all, any, not, owns, ownsAny, answer); itt: ${keys.join(", ") || "(üres)"}.`);
    return issues;
  }
  const kind = logic[0];
  const extra = keys.filter((k) => k !== kind && !(kind === "answer" && ["in", "gte", "lte", "answered", "skipped"].includes(k)));
  if (extra.length) bad(`Ismeretlen kulcs a feltételben: ${extra.join(", ")}.`);
  if (kind === "all" || kind === "any") {
    const arr = o[kind];
    if (!Array.isArray(arr) || arr.length === 0) bad(`„${kind}” értéke nem üres lista kell legyen.`);
    else arr.forEach((x, i) => issues.push(...checkConditionShape(x, `${path}.${kind}[${i}]`)));
  } else if (kind === "not") {
    issues.push(...checkConditionShape(o.not, `${path}.not`));
  } else if (kind === "owns") {
    if (typeof o.owns !== "string") bad("Az „owns” értéke eszköz-azonosító (szöveg) kell legyen.");
  } else if (kind === "ownsAny") {
    if (!Array.isArray(o.ownsAny) || o.ownsAny.some((x) => typeof x !== "string") || o.ownsAny.length === 0)
      bad("Az „ownsAny” értéke eszköz-azonosítók nem üres listája kell legyen.");
  } else {
    if (typeof o.answer !== "string") bad("Az „answer” értéke kártya-azonosító (szöveg) kell legyen.");
    const ops = ["in", "gte", "lte", "answered", "skipped"].filter((k) => k in o);
    if (ops.length === 0) bad("Az „answer” feltételhez kell egy operátor: in, gte, lte, answered vagy skipped.");
    if ("in" in o && (!Array.isArray(o.in) || o.in.some((x) => typeof x !== "string" && typeof x !== "number")))
      bad("Az „in” értéke szövegek vagy számok listája kell legyen.");
    for (const k of ["gte", "lte"]) if (k in o && typeof o[k] !== "number") bad(`A(z) „${k}” értéke szám kell legyen.`);
    for (const k of ["answered", "skipped"]) if (k in o && typeof o[k] !== "boolean") bad(`A(z) „${k}” értéke igaz/hamis kell legyen.`);
  }
  return issues;
}
