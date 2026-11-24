import { DEFAULT_SURVEY } from "../content/survey.ts";
import type { SessionState } from "../engine/session.ts";
import { APPRAISAL_CARD, REACTION_CARD } from "../engine/temperature.ts";
import type { ResponseRecord } from "../engine/types.ts";
import { deliveryQueue } from "./delivery.ts";
import { rpc, supabaseConfigured, supabaseScope } from "./supabase.ts";

export const metricsEnabled = supabaseConfigured;

export function completionMetrics(state: SessionState, record: ResponseRecord) {
  if (!record.completed || !record.consent.participation || !record.consent.paradata ||
      !record.paradata || !record.effortLevel) return null;
  const reaction = record.temperatureArm ? record.items[REACTION_CARD] : undefined;
  const first = reaction && record.paradata[REACTION_CARD]?.firstAnswer;
  const appraisal = reaction && record.items[APPRAISAL_CARD];
  const ms = Object.values(state.paradata ?? {}).reduce((sum, card) => sum + card.dwellMs, 0);
  return {
    token: record.sessionId,
    bank_version: record.bankVersion,
    effort: record.effortLevel,
    active_seconds: state.fullTiming && ms > 0 ? Math.max(1, Math.round(ms / 1000)) : null,
    arm: record.temperatureArm ?? null,
    reaction_status: reaction?.status === "answered" || reaction?.status === "skipped" ? reaction.status : "not_shown",
    first_input: first?.input ?? null,
    first_answer_ms: first?.ms ?? null,
    use_again: appraisal?.status === "answered" && !appraisal.inactive && typeof appraisal.value === "number" ? appraisal.value : null,
  };
}

type Completion = NonNullable<ReturnType<typeof completionMetrics>>;
const outboxes = new Map<string, ReturnType<typeof deliveryQueue<Completion>>>();

function outbox(slug: string) {
  let queue = outboxes.get(slug);
  if (!queue) {
    const scope = slug === DEFAULT_SURVEY ? "" : slug + ":";
    queue = deliveryQueue<Completion>("kartya-kerdoiv:metrics:" + supabaseScope + ":" + scope, (sample) => {
      return slug === DEFAULT_SURVEY && sample.arm
        ? rpc("submit_survey_completion", sample)
        : rpc("submit_survey_metrics", { slug, ...sample });
    });
    outboxes.set(slug, queue);
  }
  return queue;
}

export function queueCompletion(state: SessionState, record: ResponseRecord, slug = DEFAULT_SURVEY) {
  if (!metricsEnabled) return;
  const sample = completionMetrics(state, record);
  if (sample) outbox(slug).put(sample.token, sample);
}

export function retryCompletions(slug = DEFAULT_SURVEY) {
  if (metricsEnabled) outbox(slug).retry();
}

const reads = new Map<string, Promise<Map<string, number>>>();
export function effortMedians(version: string, slug = DEFAULT_SURVEY) {
  const id = slug + ":" + version;
  const existing = reads.get(id);
  if (existing) return existing;
  const request = rpc("survey_effort_medians", slug === DEFAULT_SURVEY ? { version } : { slug, version })
    .then(async (r) => {
      const rows = await r.json() as { effort: string; median_minutes: number | string }[];
      const medians = new Map<string, number>();
      for (const row of rows) {
        const minutes = Number(row.median_minutes);
        if (Number.isFinite(minutes)) medians.set(row.effort, minutes);
      }
      return medians;
    })
    .finally(() => reads.delete(id));
  reads.set(id, request);
  return request;
}
