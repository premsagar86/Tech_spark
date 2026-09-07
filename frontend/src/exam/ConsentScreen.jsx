// Monitoring disclosure. Must be accepted before getUserMedia is called (the
// SDK requests the camera at arm() time, inside the "Start exam" gesture).
export default function ConsentScreen({ exam, onAgree, onCancel }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <h1 className="text-3xl">{exam.title}</h1>
      <p className="mt-2 text-foreground-muted">
        Duration {exam.durationMinutes} minutes · {exam.questionCount} questions ·
        auto-submit after {exam.strikeLimit} violations
      </p>

      <div className="mt-6 space-y-4 rounded-lg border border-border bg-raised p-5 text-sm">
        <p className="font-semibold text-foreground">While the test is running, this page monitors:</p>
        <ul className="list-disc space-y-1 pl-5 text-foreground-muted">
          <li>Leaving the exam tab or window, or exiting fullscreen.</li>
          <li>Opening new tabs, other applications, or a second monitor.</li>
          <li>Copy / paste, right-click, and developer-tools shortcuts.</li>
          {exam.requireCamera && (
            <li>
              <strong>Camera:</strong> your webcam is used <em>only</em> to check that
              exactly one person is present. No photos or video are recorded,
              stored, or uploaded — only a face count and timestamps.
            </li>
          )}
          {exam.requireExtension && <li>Tab and window activity, via the required proctor extension.</li>}
        </ul>
        <p className="text-foreground-muted">
          Each violation shows a warning. After {exam.strikeLimit} violations the
          test is submitted automatically with whatever you have answered.
          Violation events are visible to exam administrators.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button onClick={onCancel} className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
          Cancel
        </button>
        <button
          onClick={onAgree}
          className="rounded-full bg-primary px-8 py-2 font-semibold text-background hover:bg-primary-light"
        >
          I understand — continue
        </button>
      </div>
    </div>
  );
}
