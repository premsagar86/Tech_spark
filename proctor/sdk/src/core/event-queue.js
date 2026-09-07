// Batches proctor events and ships them to the backend ingest endpoint.
//
// Design points:
//  - Events are flushed on a short interval OR immediately when a `strike`
//    severity event lands (so auto-submit isn't delayed by the batch timer).
//  - Failed flushes retry with capped exponential backoff; nothing is dropped
//    except by the hard `maxBuffer` cap (which itself emits a `queue_overflow`).
//  - On page hide/unload the buffer is flushed with `navigator.sendBeacon` so a
//    candidate closing the tab still delivers their final events.
//  - Every batch carries a monotonic `seq` per event and an HMAC over the batch
//    (see signer.js) so the server can detect gaps and forgery.
//
// `getConfig()` returns the live { ingestUrl, attemptId } — they may not be
// known at construction time (the attempt is created by POST /start, after the
// SDK is already initialised for the handshake).

const DEFAULTS = {
  flushIntervalMs: 4000,
  maxBatch: 40,
  maxBuffer: 500,
  maxRetries: 6,
  baseBackoffMs: 800,
};

export function createEventQueue({ getConfig, getSign, onServerState, getAuthMeta, config = {} }) {
  const cfg = { ...DEFAULTS, ...config };
  /** @type {any[]} */
  let buffer = [];
  let seq = 0;
  let timer = null;
  let flushing = false;
  let stopped = false;

  function ready() {
    const c = getConfig();
    return c && c.ingestUrl && c.attemptId;
  }

  function schedule() {
    if (timer || stopped) return;
    timer = setTimeout(() => {
      timer = null;
      flush().catch(() => {});
    }, cfg.flushIntervalMs);
  }

  function enqueue(event) {
    if (stopped) return;
    seq += 1;
    const record = { ...event, seq, clientTs: event.clientTs ?? Date.now() };
    buffer.push(record);
    if (buffer.length > cfg.maxBuffer) {
      buffer.splice(0, buffer.length - cfg.maxBuffer);
      buffer.push({ kind: "queue_overflow", severity: "info", seq: (seq += 1), clientTs: Date.now() });
    }
    if (event.severity === "strike" || buffer.length >= cfg.maxBatch) {
      flush().catch(() => {});
    } else {
      schedule();
    }
    return record;
  }

  async function postBatch(events, { beacon = false } = {}) {
    const { ingestUrl, attemptId } = getConfig();
    const body = {
      attemptId,
      sentAt: Date.now(),
      events,
      meta: getAuthMeta?.() ?? {},
    };
    body.sig = await getSign()(body.events);

    if (beacon && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      return navigator.sendBeacon(ingestUrl, blob);
    }

    const res = await fetch(ingestUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: beacon,
    });
    if (!res.ok) throw new Error(`ingest ${res.status}`);
    const data = await res.json().catch(() => ({}));
    if (data && typeof data.strikes === "number") onServerState?.(data);
    return data;
  }

  async function flush({ beacon = false } = {}) {
    if (stopped && !beacon) return;
    if (flushing && !beacon) return;
    if (buffer.length === 0 || !ready()) return;
    flushing = true;
    const batch = buffer.splice(0, beacon ? buffer.length : cfg.maxBatch);
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await postBatch(batch, { beacon });
        break;
      } catch {
        attempt += 1;
        if (beacon || attempt > cfg.maxRetries) {
          buffer.unshift(...batch);
          break;
        }
        const wait = Math.min(cfg.baseBackoffMs * 2 ** (attempt - 1), 15000);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    flushing = false;
    if (buffer.length > 0 && !stopped) schedule();
  }

  return {
    enqueue,
    flush,
    flushBeacon: () => flush({ beacon: true }),
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    get pending() {
      return buffer.length;
    },
  };
}
