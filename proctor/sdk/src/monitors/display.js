// Flags a multi-monitor setup — the classic "answers on the second screen"
// case. In-page detection is limited:
//   - `window.screen.isExtended` (Chromium) is true when more than one display
//     is connected. No permission needed, but only a boolean.
//   - The Window Management API (`getScreenDetails()`) gives per-screen detail
//     but needs the `window-management` permission; we only call it if already
//     granted so we never surface a second permission prompt mid-exam.
//
// The MV3 extension's `chrome.system.display.getInfo()` is the authoritative
// source; this is the fallback when no extension is present.

export function createDisplayMonitor({ report, opts = {} }) {
  const intervalMs = opts.intervalMs ?? 5000;
  let id = null;
  let reported = false;

  async function check() {
    let extended = false;
    let count = 1;
    try {
      if (typeof window.screen?.isExtended === "boolean") {
        extended = window.screen.isExtended;
      }
      if (extended && navigator.permissions && window.getScreenDetails) {
        const status = await navigator.permissions.query({ name: "window-management" }).catch(() => null);
        if (status && status.state === "granted") {
          const details = await window.getScreenDetails();
          count = details.screens.length;
        }
      }
    } catch {
      /* ignore */
    }
    if (extended && !reported) {
      reported = true;
      report("multi_display", { screens: count > 1 ? count : "2+" });
    } else if (!extended) {
      reported = false;
    }
  }

  return {
    start() {
      id = setInterval(check, intervalMs);
      check();
    },
    stop() {
      if (id) clearInterval(id);
      id = null;
    },
  };
}
