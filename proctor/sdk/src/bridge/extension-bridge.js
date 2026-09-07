// Talks to the TechSpark MV3 extension from the page.
//
// Two channels:
//  1. A MAIN-world shim the extension's content script injects, which sets
//     `window.__PROCTOR_EXT__ = { version }` synchronously. Lets the page know
//     an extension is installed before any async round-trip.
//  2. `window.postMessage` for the actual handshake and the event stream the
//     background service worker forwards (tab switches, real window blur,
//     authoritative multi-display, navigation attempts).
//
// Message shape on the wire (both directions), namespaced so it can't collide
// with the host app's own postMessage traffic:
//   { source: "techspark-proctor", dir: "page"|"ext", type, ...payload }
//
// The handshake is bound to a `context` string the page already knows before
// the attempt exists (the exam slug) — NOT the attempt id, which POST /start
// only creates afterwards.

const NS = "techspark-proctor";
const HANDSHAKE_TIMEOUT_MS = 4000;

export function detectExtensionSync() {
  const shim = typeof window !== "undefined" && window.__PROCTOR_EXT__;
  return shim && typeof shim.version === "string" ? { installed: true, version: shim.version } : { installed: false };
}

export function createExtensionBridge({ context, emit }) {
  let connected = false;
  let extVersion = null;
  let onEventCb = null;
  let listening = false;
  let pageMsgHandler = null;

  function send(type, payload = {}) {
    window.postMessage({ source: NS, dir: "page", type, context, ...payload }, window.location.origin);
  }

  function startListening() {
    if (listening) return;
    pageMsgHandler = (ev) => {
      if (ev.source !== window) return;
      const msg = ev.data;
      if (!msg || msg.source !== NS || msg.dir !== "ext") return;

      if (msg.type === "READY") {
        connected = true;
        extVersion = msg.version || null;
        emit("handshake", { ok: true, version: extVersion, proof: msg.proof, capabilities: msg.capabilities || [] });
      } else if (msg.type === "EVENT") {
        onEventCb?.({ kind: msg.kind, detail: msg.detail || {}, clientTs: msg.clientTs || Date.now(), source: "extension" });
      } else if (msg.type === "EXT_GONE") {
        if (connected) emit("extension_lost", {});
        connected = false;
      }
    };
    window.addEventListener("message", pageMsgHandler);
    listening = true;
  }

  function stopListening() {
    if (pageMsgHandler) window.removeEventListener("message", pageMsgHandler);
    pageMsgHandler = null;
    listening = false;
  }

  return {
    /**
     * Detect + verify the extension. Returns
     * { installed, connected, version, proof, capabilities }.
     * `proof` is the extension's signature over `context` — the page passes it
     * to POST /start where the backend verifies it against PROCTOR_EXT_SHARED_SECRET.
     */
    async handshake() {
      const sync = detectExtensionSync();
      startListening();
      if (!sync.installed) return { installed: false, connected: false };

      return new Promise((resolve) => {
        let settled = false;
        const handler = (ev) => {
          if (ev.source !== window) return;
          const msg = ev.data;
          if (!msg || msg.source !== NS || msg.dir !== "ext" || msg.type !== "READY") return;
          window.removeEventListener("message", handler);
          if (settled) return;
          settled = true;
          resolve({ installed: true, connected: true, version: msg.version, proof: msg.proof, capabilities: msg.capabilities || [] });
        };
        window.addEventListener("message", handler);
        send("HELLO", { origin: window.location.origin });
        setTimeout(() => {
          window.removeEventListener("message", handler);
          if (settled) return;
          settled = true;
          resolve({ installed: true, connected: false });
        }, HANDSHAKE_TIMEOUT_MS);
      });
    },

    onEvent(cb) {
      onEventCb = cb;
    },
    arm() {
      send("ARM");
    },
    disarm() {
      send("DISARM");
      stopListening();
    },
    get connected() {
      return connected;
    },
    get version() {
      return extVersion;
    },
  };
}
