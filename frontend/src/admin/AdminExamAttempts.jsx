import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { clearAdminSession } from "../lib/session.js";

const statusBadge = {
  in_progress: "bg-primary/15 text-primary",
  submitted: "bg-accent/15 text-accent",
  auto_submitted: "bg-red-500/15 text-red-400",
  expired: "bg-yellow-500/15 text-yellow-400",
};

const sevColor = {
  info: "text-foreground-muted",
  warn: "text-yellow-400",
  strike: "text-red-400",
};

export default function AdminExamAttempts() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  function handleAuthError(err) {
    setError(err.message);
    if (/401|not authenticated|invalid or expired/i.test(err.message)) {
      clearAdminSession();
      navigate("/login");
    }
  }

  async function load() {
    try {
      setData(await api.listExamAttempts(slug));
    } catch (err) {
      handleAuthError(err);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">
          Exam attempts{data?.exam ? ` — ${data.exam.title}` : ""}
        </h1>
        <Link to="/admin" className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary">
          Back to dashboard
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Candidate</th>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Strikes</th>
              <th className="px-3 py-2">Events</th>
              <th className="px-3 py-2">Auto score</th>
              <th className="px-3 py-2">Final score</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.attempts || []).map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-3 py-2">{a.participant.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.participant.rollNumber}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[a.status] ?? ""}`}>{a.status}</span>
                </td>
                <td className="px-3 py-2">
                  {a.strikeEvents}/{data.exam.strikeLimit}
                </td>
                <td className="px-3 py-2">{a.totalEvents}</td>
                <td className="px-3 py-2">{a.autoScore ?? "—"}</td>
                <td className="px-3 py-2">{a.score ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-foreground-muted">
                  {a.startedAt ? new Date(a.startedAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
                  >
                    {openId === a.id ? "Close" : "Review"}
                  </button>
                </td>
              </tr>
            ))}
            {data && data.attempts.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-foreground-muted" colSpan={9}>
                  No attempts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && <AttemptDetail attemptId={openId} onScored={load} />}
    </section>
  );
}

function AttemptDetail({ attemptId, onScored }) {
  const [detail, setDetail] = useState(null);
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setDetail(null);
    api
      .getExamAttemptDetail(attemptId)
      .then((d) => {
        setDetail(d);
        setScore(d.attempt.score ?? "");
      })
      .catch((e) => setErr(e.message));
  }, [attemptId]);

  async function saveScore() {
    setBusy(true);
    setErr(null);
    try {
      await api.setExamAttemptScore(attemptId, Number(score));
      onScored?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (err) return <p className="mt-4 text-sm text-red-400">{err}</p>;
  if (!detail) return <p className="mt-4 text-foreground-muted">Loading attempt…</p>;

  const { attempt, events, questions } = detail;

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <Info label="Status" value={attempt.status} />
        <Info label="Strikes" value={`${attempt.strikes}/${attempt.strikeLimit}`} />
        <Info label="Auto score" value={attempt.autoScore ?? "—"} />
        <Info label="Started" value={fmt(attempt.startedAt)} />
        <Info label="Submitted" value={fmt(attempt.submittedAt)} />
        <Info label="Extension" value={attempt.extensionVersion || "—"} />
        <Info label="IP" value={attempt.ip || "—"} />
        <Info label="User agent" value={attempt.userAgent || "—"} className="sm:col-span-3 truncate" />
      </div>

      <h3 className="mt-5 text-base font-semibold">Violation timeline ({events.length})</h3>
      <div className="mt-2 max-h-72 overflow-auto rounded border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-raised text-foreground-muted">
            <tr>
              <th className="px-2 py-1">Server time</th>
              <th className="px-2 py-1">Kind</th>
              <th className="px-2 py-1">Severity</th>
              <th className="px-2 py-1">Source</th>
              <th className="px-2 py-1">Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-2 py-1 font-mono">{fmt(e.serverTs)}</td>
                <td className="px-2 py-1">{e.kind}</td>
                <td className={`px-2 py-1 ${sevColor[e.severity]}`}>{e.severity}</td>
                <td className="px-2 py-1">{e.source}</td>
                <td className="px-2 py-1 font-mono text-[11px] text-foreground-muted">
                  {e.detail ? JSON.stringify(e.detail) : ""}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-foreground-muted">
                  No proctor events recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 text-base font-semibold">Answers</h3>
      <div className="mt-2 space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded border border-border p-3 text-sm">
            <div className="text-xs text-foreground-muted">
              Q{i + 1} · {q.type} · {q.points} pts
            </div>
            <div className="mt-1 whitespace-pre-wrap font-medium">{q.prompt}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-xs text-foreground-muted">Given</span>
                <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-background p-2 text-xs">
                  {q.givenAnswer == null ? "—" : JSON.stringify(q.givenAnswer, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-xs text-foreground-muted">Correct</span>
                <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-background p-2 text-xs">
                  {q.correctAnswer == null ? "manual" : JSON.stringify(q.correctAnswer, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <span className="text-sm text-foreground-muted">Final score (incl. manual coding):</span>
        <input
          type="number"
          step="0.01"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-24 rounded border border-border bg-raised px-2 py-1 text-sm"
        />
        <button
          onClick={saveScore}
          disabled={busy || score === ""}
          className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-background hover:bg-primary-light disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Info({ label, value, className = "" }) {
  return (
    <div className={className}>
      <div className="text-xs text-foreground-muted">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString() : "—";
}
