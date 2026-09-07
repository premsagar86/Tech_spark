// Intercepts keyboard shortcuts that open dev tools, print, view source, save,
// or spawn/close tabs and windows. Each blocked combo is a `blocked_shortcut`
// (warn) with the specific combo in `detail` for the timeline.
//
// Notes / honest limits:
//  - The browser won't let a page cancel every combo. Ctrl/Cmd+T, Ctrl+N,
//    Ctrl+W, Alt+Tab and Alt+F4 are handled by the OS/browser before the page
//    sees them (or can't be cancelled). We still log the keydown we do get; the
//    MV3 extension is what actually catches the resulting tab/window change.

const COMBOS = [
  { id: "devtools_f12", match: (e) => e.key === "F12" },
  { id: "devtools_inspect", match: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C"].includes(up(e.key)) },
  { id: "view_source", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "U" },
  { id: "save_page", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "S" },
  { id: "print", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "P" },
  { id: "new_tab", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "T" },
  { id: "new_window", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "N" },
  { id: "close_tab", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "W" },
  { id: "location_bar", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "L" },
  { id: "find", match: (e) => (e.ctrlKey || e.metaKey) && up(e.key) === "F" },
];

function up(k) {
  return (k || "").toUpperCase();
}

export function createKeyboardMonitor({ report, opts = {} }) {
  const block = opts.block ?? true;
  // Copy/paste keys are handled by the clipboard monitor via the actual
  // copy/paste events; don't double-report them here.
  const onKeyDown = (e) => {
    const hit = COMBOS.find((c) => c.match(e));
    if (!hit) return;
    report("blocked_shortcut", { combo: hit.id });
    if (block) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    start() {
      window.addEventListener("keydown", onKeyDown, true);
    },
    stop() {
      window.removeEventListener("keydown", onKeyDown, true);
    },
  };
}
