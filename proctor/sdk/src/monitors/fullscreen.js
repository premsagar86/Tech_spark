// Keeps the exam in fullscreen. Exposes `request()` (must be called from a user
// gesture — the exam page wires it to the "Start exam" button) and reports
// `fullscreen_exit` whenever the document leaves fullscreen while armed.
//
// It does NOT force re-entry itself (browsers require a fresh gesture); the exam
// shell shows a blocking "Return to fullscreen" overlay instead.

function fsElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function enter(el) {
  const target = el || document.documentElement;
  if (target.requestFullscreen) return target.requestFullscreen();
  if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen();
  throw new Error("Fullscreen API unavailable");
}

export function createFullscreenMonitor({ report, opts = {} }) {
  let armed = false;

  const onChange = () => {
    if (!armed) return;
    if (!fsElement()) report("fullscreen_exit", { via: "fullscreenchange" });
  };

  return {
    isFullscreen: () => !!fsElement(),
    async request(el) {
      await enter(el || opts.element);
    },
    async release() {
      if (fsElement() && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
    },
    start() {
      armed = true;
      document.addEventListener("fullscreenchange", onChange);
      document.addEventListener("webkitfullscreenchange", onChange);
    },
    stop() {
      armed = false;
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    },
  };
}
