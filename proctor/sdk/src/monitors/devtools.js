// Heuristic dev-tools-open detector. Every technique here is defeatable and can
// false-positive (docked panel, zoom, slow frame), so the default policy scores
// `devtools` as `warn`, never an auto-strike. It's corroborating evidence in
// the timeline, not a trigger.
//
// Techniques, any of which flips the state:
//   1. Viewport delta: outerWidth/Height vs innerWidth/Height jumps past a
//      threshold (a docked panel steals that space).
//   2. `debugger` timing: a bare `debugger;` statement pauses only when devtools
//      is open; we measure how long a tight block takes.
//   3. console object `toString` trap: logging an object whose `id` getter fires
//      only when the console renders it.

export function createDevtoolsMonitor({ report, opts = {} }) {
  const intervalMs = opts.intervalMs ?? 1500;
  const sizeThreshold = opts.sizeThreshold ?? 160;
  let open = false;
  let id = null;

  function viewportSuggestsOpen() {
    const wDelta = window.outerWidth - window.innerWidth;
    const hDelta = window.outerHeight - window.innerHeight;
    return wDelta > sizeThreshold || hDelta > sizeThreshold;
  }

  function debuggerSuggestsOpen() {
    const t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    return performance.now() - t0 > 100;
  }

  function check() {
    let nowOpen = false;
    try {
      nowOpen = viewportSuggestsOpen();
      if (!nowOpen && opts.useDebuggerTrap) nowOpen = debuggerSuggestsOpen();
    } catch {
      /* ignore */
    }
    if (nowOpen && !open) {
      open = true;
      report("devtools", { method: "heuristic" });
    } else if (!nowOpen && open) {
      open = false;
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
