// Detects the candidate leaving the exam page: tab switch, window minimise,
// alt-tab to another app. Three overlapping signals catch cases any one alone
// would miss:
//   - visibilitychange  -> tab hidden / minimised
//   - window blur        -> focus moved to another window or the OS
//   - hasFocus() poll    -> catches focus loss some platforms don't fire blur for
//
// De-duplicated with a short cooldown so one alt-tab isn't three strikes.

export function createVisibilityMonitor({ report, opts = {} }) {
  const cooldownMs = opts.cooldownMs ?? 1200;
  let last = 0;
  let pollId = null;
  let hadFocus = true;

  function fire(kind, detail) {
    const now = Date.now();
    if (now - last < cooldownMs) return;
    last = now;
    report(kind, detail);
  }

  const onVisibility = () => {
    if (document.visibilityState === "hidden") fire("visibility_hidden", { via: "visibilitychange" });
  };
  const onBlur = () => fire("tab_blur", { via: "window.blur" });
  const onFocus = () => {
    hadFocus = true;
  };

  function startPoll() {
    pollId = setInterval(() => {
      const focused = document.hasFocus();
      if (hadFocus && !focused) fire("tab_blur", { via: "hasFocus" });
      hadFocus = focused;
    }, opts.pollMs ?? 1000);
  }

  return {
    start() {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("blur", onBlur);
      window.addEventListener("focus", onFocus);
      startPoll();
    },
    stop() {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (pollId) clearInterval(pollId);
      pollId = null;
    },
  };
}
