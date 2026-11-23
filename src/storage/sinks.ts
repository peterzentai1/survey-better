// Where responses go. v0.1 keeps everything on the device (localStorage); the remote sink is a stub.
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
  constructor(bankVersion: string) {
    this.key = `kartya-kerdoiv:${bankVersion}:session`;
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

/** Placeholder for a future backend. Deliberately not wired anywhere in v0.1. */
export class RemoteSink implements ResponseSink {
  load(): unknown {
    throw new Error("RemoteSink: not configured");
  }
  save(): void {
    throw new Error("RemoteSink: not configured");
  }
  clear(): void {
    throw new Error("RemoteSink: not configured");
  }
}
