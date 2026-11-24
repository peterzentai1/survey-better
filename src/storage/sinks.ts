import { DEFAULT_SURVEY } from "../content/survey.ts";
import type { SessionState } from "../engine/session.ts";
import type { ResponseRecord } from "../engine/types.ts";

export interface ResponseSink {
  /** Last unfinished session snapshot, or null. Must never throw. */
  load(): unknown;
  /** Persist progress (full session state plus the response record built from it). */
  save(state: SessionState, record: ResponseRecord): void;
  /** Forget the stored session. */
  clear(): void;
}

/** localStorage sink. Every access is wrapped: the app must work with storage unavailable. */
export class LocalSink implements ResponseSink {
  private readonly key: string;
  constructor(bankVersion: string, slug = DEFAULT_SURVEY) {
    const scope = slug === DEFAULT_SURVEY ? bankVersion : `${slug}:${bankVersion}`;
    this.key = `kartya-kerdoiv:${scope}:session`;
  }

  load(): unknown {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as { state?: unknown }).state ?? null : null;
    } catch {
      return null;
    }
  }

  save(state: SessionState, record: ResponseRecord): void {
    try {
      localStorage.setItem(this.key, JSON.stringify({ state, record }));
    } catch {
      /* storage full, blocked or unavailable: the questionnaire keeps working in memory */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}
