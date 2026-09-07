// @techspark/proctor-sdk — in-page proctoring monitor.
//
// Lifecycle (the exam page drives this):
//   const p = Proctor.init({ handshakeContext: examSlug, strikeLimit, camera, ... });
//   const hs = await p.handshake();          // detect + verify the MV3 extension
//   //  -> POST /api/exam/:slug/start with { extProof: hs.proof }
//   //  -> response gives { attemptId, signingKey, ingestUrl, strikeLimit }
//   p.configure({ attemptId, signingKey, ingestUrl, strikeLimit });
//   await p.arm({ fullscreenTarget });       // MUST be inside a user gesture
//   p.on('strike', ({ count, limit }) => ...);
//   p.on('autosubmit', () => submitExam());
//   p.disarm();                              // on submit / teardown
//
// The server is authoritative: every ingest response can carry
// { strikes, strikeLimit, autoSubmitted } and that overrides the local tally.

import { createEmitter } from "./core/emitter.js";
import { createSigner } from "./core/signer.js";
import { createEventQueue } from "./core/event-queue.js";
import { createStrikeEngine, DEFAULT_POLICY } from "./core/strike-engine.js";
import { createExtensionBridge, detectExtensionSync } from "./bridge/extension-bridge.js";

import { createVisibilityMonitor } from "./monitors/visibility.js";
import { createFullscreenMonitor } from "./monitors/fullscreen.js";
import { createClipboardMonitor } from "./monitors/clipboard.js";
import { createContextMenuMonitor } from "./monitors/contextmenu.js";
import { createKeyboardMonitor } from "./monitors/keyboard.js";
import { createDevtoolsMonitor } from "./monitors/devtools.js";
import { createDisplayMonitor } from "./monitors/display.js";
import { createCameraFaceMonitor } from "./monitors/camera-face.js";
import { createPageLifeMonitor } from "./monitors/pagelife.js";

export const version = "0.1.0";
export { DEFAULT_POLICY };

function init(config = {}) {
  const {
    handshakeContext = config.attemptId || "",
    attemptId = null,
    ingestUrl = null,
    signingKey = "",
    strikeLimit = 3,
    policy = {},
    requireExtension = true,
    camera = false,
    monitors = {},
    meta = {},
  } = config;

  if (!handshakeContext) throw new Error("[proctor] init: handshakeContext (or attemptId) is required");

  const emitter = createEmitter();
  const emit = emitter.emit.bind(emitter);

  // Mutable runtime config — attemptId/signingKey/ingestUrl are usually only
  // known after POST /start returns.
  const state = { attemptId, ingestUrl, signingKey };
  let sign = createSigner(signingKey);

  const strikes = createStrikeEngine({ strikeLimit, policy, emit });
  const queue = createEventQueue({
    getConfig: () => ({ ingestUrl: state.ingestUrl, attemptId: state.attemptId }),
    getSign: () => sign,
    getAuthMeta: () => ({ ...meta, extVersion: bridge.version, url: location.href }),
    onServerState: (s) => strikes.reconcile(s),
  });
  const bridge = createExtensionBridge({ context: handshakeContext, emit });

  let armed = false;
  let active = [];
  let fullscreen = null;
  let cameraMon = null;

  function report(kind, detail = {}, source = "sdk") {
    const severity = strikes.severityOf(kind);
    strikes.record(kind); // optimistic; server reconciles
    const record = { kind, severity, detail, source, clientTs: Date.now() };
    const stored = queue.enqueue(record);
    emit("event", stored || record);
  }

  function buildMonitors() {
    const m = (name) => monitors[name] || {};
    const list = [
      ["visibility", createVisibilityMonitor({ report, opts: m("visibility") })],
      ["clipboard", createClipboardMonitor({ report, opts: m("clipboard") })],
      ["contextmenu", createContextMenuMonitor({ report, opts: m("contextmenu") })],
      ["keyboard", createKeyboardMonitor({ report, opts: m("keyboard") })],
      ["devtools", createDevtoolsMonitor({ report, opts: m("devtools") })],
      ["display", createDisplayMonitor({ report, opts: m("display") })],
      ["pagelife", createPageLifeMonitor({ report, opts: m("pagelife") })],
    ];
    fullscreen = createFullscreenMonitor({ report, opts: m("fullscreen") });
    list.push(["fullscreen", fullscreen]);
    if (camera) {
      const camOpts = typeof camera === "object" ? camera : {};
      cameraMon = createCameraFaceMonitor({ report, opts: camOpts });
      list.push(["camera", cameraMon]);
    }
    return list;
  }

  const sdk = {
    // --- discovery -------------------------------------------------------
    hasExtension: () => detectExtensionSync().installed,

    async handshake() {
      const res = await bridge.handshake();
      if (!res.installed) {
        report("extension_missing", {}, "sdk");
      } else if (!res.connected) {
        report("extension_missing", { reason: "no_response" }, "sdk");
      } else {
        report("handshake_ok", { version: res.version }, "sdk");
        bridge.onEvent(({ kind, detail, source }) => report(kind, detail, source || "extension"));
        bridge.arm();
      }
      res.requiredButMissing = requireExtension && !res.connected;
      return res;
    },

    // --- config after /start ----------------------------------------------
    configure(patch = {}) {
      if (patch.attemptId != null) state.attemptId = patch.attemptId;
      if (patch.ingestUrl != null) state.ingestUrl = patch.ingestUrl;
      if (patch.signingKey != null && patch.signingKey !== state.signingKey) {
        state.signingKey = patch.signingKey;
        sign = createSigner(patch.signingKey);
      }
      if (typeof patch.strikeLimit === "number") strikes.reconcile({ strikeLimit: patch.strikeLimit });
      return sdk;
    },

    // --- run ------------------------------------------------------------
    async arm(o = {}) {
      if (armed) return;
      if (!state.attemptId || !state.ingestUrl) {
        throw new Error("[proctor] arm: call configure({ attemptId, ingestUrl }) after POST /start first");
      }
      armed = true;
      active = buildMonitors();
      for (const [, mon] of active) {
        try {
          mon.start();
        } catch (err) {
          console.error("[proctor] monitor start failed", err);
        }
      }
      if (fullscreen) {
        try {
          await fullscreen.request(o.fullscreenTarget);
        } catch {
          report("fullscreen_exit", { reason: "request_failed" });
        }
      }
      if (cameraMon) {
        try {
          await cameraMon.start();
        } catch {
          /* camera_denied already reported by the monitor */
        }
      }
      emit("armed", sdk.getStatus());
    },

    async requestFullscreen(target) {
      if (fullscreen) await fullscreen.request(target);
    },
    isFullscreen: () => (fullscreen ? fullscreen.isFullscreen() : false),

    disarm() {
      if (!armed) return;
      armed = false;
      for (const [, mon] of active) {
        try {
          mon.stop();
        } catch {
          /* ignore */
        }
      }
      active = [];
      bridge.disarm();
      queue.flushBeacon();
      queue.stop();
      emit("disarmed", {});
    },

    // --- events / status ---------------------------------------------------
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),

    getStatus() {
      return {
        armed,
        attemptId: state.attemptId,
        strikes: strikes.strikes,
        limit: strikes.limit,
        autoSubmitted: strikes.autoSubmitted,
        pendingEvents: queue.pending,
        extension: { installed: sdk.hasExtension(), connected: bridge.connected, version: bridge.version },
      };
    },

    _simulate: (kind, detail) => report(kind, detail, "sdk"),
  };

  return sdk;
}

export const Proctor = { init, version, DEFAULT_POLICY };
export default Proctor;

if (typeof window !== "undefined") {
  window.Proctor = Proctor;
}
