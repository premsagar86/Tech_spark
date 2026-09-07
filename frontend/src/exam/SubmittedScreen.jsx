import { Link } from "react-router-dom";

const HEADLINES = {
  submitted: "Test submitted",
  auto_submitted: "Test auto-submitted",
  expired: "Time's up — test submitted",
};

export default function SubmittedScreen({ result }) {
  const status = result?.status || "submitted";
  const auto = status === "auto_submitted";

  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-3xl">{HEADLINES[status] || HEADLINES.submitted}</h1>

      {auto && (
        <p className="mt-4 text-red-400">
          Your test was submitted automatically because the violation limit was
          reached. Your saved answers were recorded.
        </p>
      )}
      {!auto && <p className="mt-4 text-foreground-muted">Your answers have been recorded.</p>}

      {result?.revealScore ? (
        <div className="mt-6 rounded-lg border border-border bg-raised p-4">
          <div className="text-sm text-foreground-muted">Auto-graded score</div>
          <div className="text-2xl font-semibold">
            {result.autoScore} / {result.autoMax}
          </div>
          {result.manualPending > 0 && (
            <div className="mt-1 text-xs text-foreground-muted">
              + {result.manualPending} points pending manual review
            </div>
          )}
        </div>
      ) : (
        <p className="mt-6 text-sm text-foreground-muted">
          Results will be published by the exam coordinators.
        </p>
      )}

      <Link to="/" className="mt-8 inline-block rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
        Back to home
      </Link>
    </div>
  );
}
