// Catches the candidate trying to leave / reload / close the exam page.
//   - beforeunload: show the native "leave site?" prompt AND log the attempt.
//   - pagehide: last chance to flush the event queue via sendBeacon (the queue
//     wires this itself, but we also emit a marker event).
//
// A reload isn't necessarily cheating (flaky wifi), so `page_hidden` is `info`;
// the value is having it on the timeline next to a gap in the event `seq`.

export function createPageLifeMonitor({ report, opts = {} }) {
  const warnOnUnload = opts.warnOnUnload ?? true;

  const onBeforeUnload = (e) => {
    report("page_hidden", { via: "beforeunload" });
    if (warnOnUnload) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  };
  const onPageHide = () => report("page_hidden", { via: "pagehide" });

  return {
    start() {
      window.addEventListener("beforeunload", onBeforeUnload);
      window.addEventListener("pagehide", onPageHide);
    },
    stop() {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    },
  };
}
