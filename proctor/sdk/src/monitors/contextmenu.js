// Blocks and logs right-click. Low signal on its own (candidates right-click by
// habit) so it's a `warn`, but a burst of them alongside other events is useful
// context in the admin timeline.

export function createContextMenuMonitor({ report, opts = {} }) {
  const block = opts.block ?? true;

  const onContext = (e) => {
    report("contextmenu", { x: e.clientX, y: e.clientY });
    if (block) e.preventDefault();
  };

  return {
    start() {
      document.addEventListener("contextmenu", onContext, true);
    },
    stop() {
      document.removeEventListener("contextmenu", onContext, true);
    },
  };
}
