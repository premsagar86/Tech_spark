// Minimal typed-ish event emitter. No deps so the SDK stays droppable into any
// page (ESM import or the IIFE-style single-file build).
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => this.off(event, cb);
    },
    off(event, cb) {
      listeners.get(event)?.delete(cb);
    },
    emit(event, ...args) {
      // Copy to an array first so a listener that unsubscribes itself mid-emit
      // doesn't corrupt the iteration.
      for (const cb of [...(listeners.get(event) || [])]) {
        try {
          cb(...args);
        } catch (err) {
          // A broken listener must never take down monitoring.
          console.error(`[proctor] listener for "${event}" threw`, err);
        }
      }
    },
    clear() {
      listeners.clear();
    },
  };
}
