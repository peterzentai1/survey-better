import type { SessionState } from "../engine/session.ts";
import { APPRAISAL_CARD, REACTION_CARD } from "../engine/temperature.ts";
import type { ResponseRecord } from "../engine/types.ts";

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const metricsEnabled = Boolean(url && key);

export function completionMetrics(state: SessionState, record: ResponseRecord) {
  if (!record.completed || !record.consent.participation || !record.consent.paradata ||
      !record.paradata || !record.effortLevel || !record.temperatureArm) return null;
  const reaction = record.items[REACTION_CARD];
  const first = record.paradata[REACTION_CARD]?.firstAnswer;
  const appraisal = record.items[APPRAISAL_CARD];
  const ms = Object.values(state.paradata ?? {}).reduce((sum, card) => sum + card.dwellMs, 0);
  return {
    token: record.sessionId,
    bank_version: record.bankVersion,
    effort: record.effortLevel,
    active_seconds: state.fullTiming && ms > 0 ? Math.max(1, Math.round(ms / 1000)) : null,
    arm: record.temperatureArm,
    reaction_status: reaction?.status === "answered" || reaction?.status === "skipped" ? reaction.status : "not_shown",
    first_input: first?.input ?? null,
    first_answer_ms: first?.ms ?? null,
    use_again: appraisal?.status === "answered" && !appraisal.inactive && typeof appraisal.value === "number" ? appraisal.value : null,
  };
}

async function rpc(name: string, body: unknown) {
  const res = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Supabase RPC " + res.status);
  return res;
}

type Completion = NonNullable<ReturnType<typeof completionMetrics>>;
const prefix = "kartya-kerdoiv:metrics:" + url + ":";
const sending = new Set<string>();
const memory = new Map<string, Completion>();

export function queueCompletion(state: SessionState, record: ResponseRecord) {
  if (!metricsEnabled) return;
  const sample = completionMetrics(state, record);
  if (!sample) return;
  const id = prefix + sample.token;
  memory.set(id, sample);
  try {
    localStorage.setItem(id, JSON.stringify(sample));
  } catch { /* In-memory delivery is still possible. */ }
  void send(id, sample);
}

async function send(id: string, sample: Completion) {
  if (sending.has(id)) return;
  sending.add(id);
  try {
    await rpc("submit_survey_completion", sample);
    memory.delete(id);
    localStorage.removeItem(id);
  } catch { /* Retain pending samples for the next online event or visit. */ }
  finally { sending.delete(id); }
}

export function retryCompletions() {
  if (!metricsEnabled) return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const id = localStorage.key(i);
      if (id?.startsWith(prefix)) {
        try {
          const sample = JSON.parse(localStorage.getItem(id) ?? "null") as Completion | null;
          if (sample && id === prefix + sample.token) memory.set(id, sample);
        } catch { /* A damaged entry must not block other receipts. */ }
      }
    }
  } catch { /* Storage may be disabled. */ }
  for (const [id, sample] of memory) void send(id, sample);
}

const reads = new Map<string, Promise<Map<string, number>>>();
export function effortMedians(version: string) {
  const existing = reads.get(version);
  if (existing) return existing;
  const request = rpc("survey_effort_medians", { version })
    .then(async (r) => {
      const rows = await r.json() as { effort: string; median_minutes: number | string }[];
      const medians = new Map<string, number>();
      for (const row of rows) {
        const minutes = Number(row.median_minutes);
        if (Number.isFinite(minutes)) medians.set(row.effort, minutes);
      }
      return medians;
    })
    .finally(() => reads.delete(version));
  reads.set(version, request);
  return request;
}
