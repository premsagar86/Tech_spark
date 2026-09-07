// Local mirror of the strike tally. Purely for instant UI feedback ("Warning
// 2/3") — the server's count from the ingest response is always treated as the
// source of truth and overrides this via `reconcile()`.
//
// `policy` maps an event `kind` to a severity. It is seeded from DEFAULT_POLICY
// and can be overridden per-exam by the caller. Keep this list in sync with the
// backend's services/strikePolicy.js.

export const DEFAULT_POLICY = {
  // Hard "left the exam" signals — a strike each.
  tab_blur: "strike",
  tab_switch: "strike",
  new_tab_opened: "strike",
  window_blur: "strike",
  visibility_hidden: "strike",
  fullscreen_exit: "strike",
  nav_attempt: "strike",
  multi_display: "strike",
  paste_large: "strike",
  multi_face: "strike",
  extension_lost: "strike",
  camera_lost: "strike",

  // Softer signals — logged and shown, but not an automatic strike. Repeated
  // occurrences can still be escalated server-side.
  copy: "warn",
  cut: "warn",
  paste: "warn",
  contextmenu: "warn",
  blocked_shortcut: "warn",
  devtools: "warn",
  no_face: "warn",
  risky_extension: "warn",

  // Informational only.
  page_hidden: "info",
  extension_missing: "info",
  camera_denied: "info",
  handshake_ok: "info",
  queue_overflow: "info",
};

export function createStrikeEngine({ strikeLimit = 3, policy = {}, emit }) {
  const merged = { ...DEFAULT_POLICY, ...policy };
  let strikes = 0;
  let autoSubmitted = false;

  function severityOf(kind) {
    return merged[kind] || "info";
  }

  function record(kind) {
    const severity = severityOf(kind);
    if (severity === "strike" && !autoSubmitted) {
      strikes += 1;
      emit("strike", { count: strikes, limit: strikeLimit, kind, optimistic: true });
      if (strikes >= strikeLimit) {
        autoSubmitted = true;
        emit("autosubmit", { reason: kind, strikes, optimistic: true });
      }
    }
    return severity;
  }

  // Server response wins. If it says we're already auto-submitted, fire the
  // event even if the local tally hadn't reached the limit yet.
  function reconcile({ strikes: serverStrikes, strikeLimit: serverLimit, autoSubmitted: serverAuto }) {
    if (typeof serverLimit === "number") strikeLimit = serverLimit;
    if (typeof serverStrikes === "number" && serverStrikes !== strikes) {
      strikes = serverStrikes;
      emit("strike", { count: strikes, limit: strikeLimit, kind: "server", optimistic: false });
    }
    if (serverAuto && !autoSubmitted) {
      autoSubmitted = true;
      emit("autosubmit", { reason: "server", strikes, optimistic: false });
    }
  }

  return {
    record,
    reconcile,
    severityOf,
    get strikes() {
      return strikes;
    },
    get limit() {
      return strikeLimit;
    },
    get autoSubmitted() {
      return autoSubmitted;
    },
  };
}
