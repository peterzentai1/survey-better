// The local outbox survives reloads. The server's receipt constraint handles cross-tab retries.
export function deliveryQueue<T>(prefix: string, deliver: (entry: T) => Promise<unknown>) {
  const pending = new Map<string, T>();
  const sending = new Set<string>();

  function forget(id: string) {
    pending.delete(id);
    try { localStorage.removeItem(id); } catch { /* Storage may be disabled. */ }
  }

  async function send(id: string, entry: T) {
    if (sending.has(id)) return;
    sending.add(id);
    try {
      await deliver(entry);
      forget(id);
    } catch { /* Retry on the next visit or online event. */ }
    finally { sending.delete(id); }
  }

  function outboxKeys() {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const id = localStorage.key(i);
        if (id?.startsWith(prefix)) keys.push(id);
      }
    } catch { /* In-memory delivery remains available. */ }
    return keys;
  }

  return {
    put(receipt: string, entry: T) {
      const id = prefix + receipt;
      pending.set(id, entry);
      try { localStorage.setItem(id, JSON.stringify(entry)); } catch { /* Retry from memory. */ }
      void send(id, entry);
    },
    retry() {
      for (const id of outboxKeys()) {
        try {
          const entry = JSON.parse(localStorage.getItem(id) ?? "null") as T | null;
          if (entry !== null) pending.set(id, entry);
        } catch { /* A damaged entry must not block other receipts. */ }
      }
      for (const [id, entry] of pending) void send(id, entry);
    },
    clear() {
      for (const id of outboxKeys()) forget(id);
      pending.clear();
    },
  };
}
