import { useState } from "react";

// Shown when an exam requires the proctor extension and it isn't installed /
// isn't responding. The candidate cannot start until the re-check succeeds.
export default function ExtensionGate({ state, onRecheck, extensionUrl }) {
  const [checking, setChecking] = useState(false);

  async function recheck() {
    setChecking(true);
    try {
      await onRecheck();
    } finally {
      setChecking(false);
    }
  }

  const installed = state?.installed;

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-3xl">Proctor extension required</h1>
      <p className="mt-4 text-foreground-muted">
        This entrance test is monitored. You must install and enable the
        TechSpark Exam Proctor browser extension before you can begin.
      </p>

      <ol className="mt-6 space-y-2 text-left text-sm text-foreground-muted">
        <li>
          1. Install the extension
          {extensionUrl ? (
            <>
              {" "}from{" "}
              <a href={extensionUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                the Chrome Web Store
              </a>
            </>
          ) : (
            " provided by your exam coordinator"
          )}
          .
        </li>
        <li>2. Make sure it is enabled for this site.</li>
        <li>3. Use Google Chrome or Microsoft Edge on a desktop/laptop.</li>
        <li>4. Click “Re-check” below.</li>
      </ol>

      <div className="mt-6 rounded-lg border border-border bg-raised p-3 text-sm">
        Status:{" "}
        <span className={installed ? "text-yellow-400" : "text-red-400"}>
          {installed ? "installed but not responding" : "not detected"}
        </span>
      </div>

      <button
        onClick={recheck}
        disabled={checking}
        className="mt-6 rounded-full bg-primary px-8 py-2 font-semibold text-background hover:bg-primary-light disabled:opacity-50"
      >
        {checking ? "Checking…" : "Re-check"}
      </button>
    </div>
  );
}
