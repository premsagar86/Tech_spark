// Thin wrapper around @techspark/proctor-sdk for the exam page. Keeps all SDK
// wiring in one place and exposes a small promise/callback surface to Exam.jsx.
//
// The SDK is aliased (see frontend/vite.config.js) to the sibling
// proctor/sdk/src — the reusable, framework-agnostic monitor.

import { Proctor } from "@techspark/proctor-sdk";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Optional: plug a real face detector (MediaPipe / face-api.js) here to get
// true multi-face counting. Bundle its model files with the app — the exam
// page's CSP blocks third-party fetches. Left null => the SDK uses its
// built-in "camera covered / black frame" fallback (no_face only).
const faceDetector = null;

export function createProctor({ examSlug, strikeLimit, requireExtension, requireCamera }) {
  const p = Proctor.init({
    handshakeContext: examSlug,
    strikeLimit,
    requireExtension,
    camera: requireCamera ? { detector: faceDetector } : false,
    // devtools stays a warning, not a strike — it false-positives on docked
    // panels / zoom.
    policy: {},
    meta: { examSlug },
    monitors: {
      clipboard: { block: true, largePasteChars: 120 },
      keyboard: { block: true },
      contextmenu: { block: true },
    },
  });

  return {
    sdk: p,
    hasExtension: () => p.hasExtension(),

    /** Detect + verify the extension. Returns { installed, connected, proof, ... }. */
    handshake: () => p.handshake(),

    /**
     * Called after POST /start succeeds. Wires the real attempt id + signing
     * key + ingest URL into the SDK.
     */
    configure({ attemptId, signingKey, ingestPath }) {
      p.configure({
        attemptId,
        signingKey,
        ingestUrl: `${API_BASE}${ingestPath}`,
      });
    },

    arm: (opts) => p.arm(opts),
    disarm: () => p.disarm(),
    isFullscreen: () => p.isFullscreen(),
    requestFullscreen: (el) => p.requestFullscreen(el),
    getStatus: () => p.getStatus(),

    on: (event, cb) => p.on(event, cb),
  };
}
