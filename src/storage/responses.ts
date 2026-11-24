import { acceptingResponses, type StorageSettings } from "../content/survey.ts";
import type { ResponseRecord } from "../engine/types.ts";
import { deliveryQueue } from "./delivery.ts";
import { rpc, supabaseConfigured, supabaseScope } from "./supabase.ts";

type Payload = Omit<ResponseRecord, "sessionId">;

export function responseOutbox(slug: string, settings: StorageSettings) {
  const enabled = settings.mode === "supabase" && supabaseConfigured;
  function payloadFor(record: Payload): Payload {
    if (settings.paradata && record.consent.paradata) return record;
    const { paradata: _paradata, effortChangedFromDefault: _change, ...payload } = record;
    return { ...payload, consent: { ...payload.consent, paradata: false } };
  }

  const queue = deliveryQueue<Payload & { sessionId: string }>("kartya-kerdoiv:responses:" + supabaseScope + ":" + slug + ":", (record) => {
    const { sessionId: receipt, ...payload } = record;
    return rpc("submit_response", { slug, receipt, payload: payloadFor(payload) });
  });

  return {
    submit(record: ResponseRecord) {
      if (!enabled || !acceptingResponses(settings) || !record.completed || !record.consent.participation) return;
      const { sessionId, ...payload } = record;
      queue.put(sessionId, { ...payloadFor(payload), sessionId });
    },
    retry() {
      if (settings.retentionUntil && new Date().toISOString().slice(0, 10) > settings.retentionUntil) queue.clear();
      else if (enabled && acceptingResponses(settings)) queue.retry();
    },
  };
}

export async function responseCount(slug: string) {
  const response = await rpc("survey_response_count", { slug });
  return await response.json() as number | string | null;
}
