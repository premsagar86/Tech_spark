// Blocks the exam whenever fullscreen has been lost. Re-entering fullscreen
// needs a fresh user gesture, so this is a button, not an automatic call.
export default function FullscreenOverlay({ onReturn }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 text-center">
      <h2 className="text-2xl">Return to fullscreen to continue</h2>
      <p className="mt-2 max-w-sm text-sm text-foreground-muted">
        Leaving fullscreen counts as a violation. Your timer is still running.
      </p>
      <button
        onClick={onReturn}
        className="mt-6 rounded-full bg-primary px-8 py-2 font-semibold text-background hover:bg-primary-light"
      >
        Return to fullscreen
      </button>
    </div>
  );
}
