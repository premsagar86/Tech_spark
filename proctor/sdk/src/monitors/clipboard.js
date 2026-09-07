// Watches clipboard activity on the exam surface. Copy/cut/paste are logged as
// `warn`; a paste larger than `largePasteChars` is escalated to `paste_large`
// (a strike) since that's the shape of dropping in an external solution.
//
// `opts.block` (default true) also calls preventDefault so the paste never
// lands — set false if a question legitimately needs paste (rare).

export function createClipboardMonitor({ report, opts = {} }) {
  const largePasteChars = opts.largePasteChars ?? 120;
  const block = opts.block ?? true;

  const onCopy = () => report("copy", {});
  const onCut = () => report("cut", {});
  const onPaste = (e) => {
    let text = "";
    try {
      text = (e.clipboardData || window.clipboardData)?.getData("text") ?? "";
    } catch {
      /* some browsers deny read in the handler */
    }
    const len = text.length;
    if (len >= largePasteChars) {
      report("paste_large", { length: len });
    } else {
      report("paste", { length: len });
    }
    if (block) e.preventDefault();
  };

  return {
    start() {
      document.addEventListener("copy", onCopy, true);
      document.addEventListener("cut", onCut, true);
      document.addEventListener("paste", onPaste, true);
    },
    stop() {
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("paste", onPaste, true);
    },
  };
}
