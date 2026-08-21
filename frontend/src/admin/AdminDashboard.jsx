import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { clearAdminSession } from "../lib/session.js";

const fieldClass =
  "rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

const statusBadge = {
  paid: "bg-accent/15 text-accent",
  not_required: "bg-accent/15 text-accent",
  created: "bg-primary/15 text-primary",
  failed: "bg-red-500/15 text-red-400",
};

const statCards = [
  { key: "teams", label: "Total Teams", className: "text-foreground" },
  { key: "paid", label: "Paid", className: "text-accent" },
  { key: "created", label: "Pending", className: "text-primary" },
  { key: "failed", label: "Failed", className: "text-red-400" },
  { key: "not_required", label: "Free (No Payment)", className: "text-accent" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [teamEventFilter, setTeamEventFilter] = useState("");
  const [soloEventFilter, setSoloEventFilter] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [addMemberFor, setAddMemberFor] = useState(null);

  useEffect(() => {
    api.getEvents().then((data) => setEvents(data.events));
  }, []);

  function handleAuthError(err) {
    setError(err.message);
    if (err.message.includes("401") || /not authenticated|invalid or expired/i.test(err.message)) {
      clearAdminSession();
      navigate("/login");
      return true;
    }
    return false;
  }

  // Event filtering happens client-side (see teamRows/soloRows below) so the
  // two tables can be filtered independently — only search/paymentStatus
  // narrow what's fetched from the server.
  async function load(overrides = {}) {
    setLoading(true);
    setError(null);
    try {
      const effectiveSearch = overrides.search ?? search;
      const effectivePaymentStatus = overrides.paymentStatus ?? paymentStatus;
      const params = {};
      if (effectiveSearch) params.search = effectiveSearch;
      if (effectivePaymentStatus) params.paymentStatus = effectivePaymentStatus;
      const data = await api.listRegistrations(params);
      setRows(data.registrations);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch {
      // Stats are a summary convenience — a failure here shouldn't block the main table.
    }
  }

  useEffect(() => {
    load();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filterByEvent(id) {
    const idStr = String(id);
    const ev = events.find((e) => String(e.id) === idStr);
    if (ev?.max_team_size > 1) {
      setTeamEventFilter(idStr);
      setSoloEventFilter("");
    } else {
      setSoloEventFilter(idStr);
      setTeamEventFilter("");
    }
    setPaymentStatus("");
    setSearch("");
    load({ paymentStatus: "", search: "" });
  }

  async function handleConfirm(id) {
    setBusyId(id);
    try {
      await api.confirmPaymentOverride(id);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    if (!confirm("Reject this payment? Double-check the order status in the Razorpay dashboard first.")) return;
    setBusyId(id);
    try {
      await api.rejectPaymentOverride(id);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this registration permanently? This removes it and all its participants from the database — this cannot be undone.")) return;
    setBusyId(id);
    try {
      await api.deleteRegistration(id);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetScore(id, score) {
    setBusyId(id);
    try {
      await api.setRegistrationScore(id, score);
      await load();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExportCsv() {
    const params = {};
    if (search) params.search = search;
    if (paymentStatus) params.paymentStatus = paymentStatus;
    const blob = await api.exportRegistrationsCsv(params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLogout() {
    clearAdminSession();
    api.adminLogout().catch(() => {});
    navigate("/login");
  }

  // Split by team_size rather than event slug — matches how the rest of the
  // backend derives behavior from event data instead of hardcoded names
  // (e.g. fee, not event name, decides whether payment is required).
  const teamEvents = events.filter((e) => e.max_team_size > 1);
  const soloEvents = events.filter((e) => e.max_team_size <= 1);
  const teamRows = rows.filter((r) => r.team_size > 1 && (!teamEventFilter || String(r.event_id) === teamEventFilter));
  const soloRows = rows.filter((r) => r.team_size <= 1 && (!soloEventFilter || String(r.event_id) === soloEventFilter));

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Admin Dashboard</h1>
        <div className="flex gap-3">
          <Link to="/admin/scan" className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary">
            Scanner
          </Link>
          <button onClick={handleLogout} className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary">
            Log out
          </button>
        </div>
      </div>

      {stats && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((c) => (
              <div key={c.key} className="rounded-lg border border-border bg-raised px-4 py-3">
                <p className="text-xs text-foreground-muted">{c.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${c.className}`}>{stats.totals[c.key] ?? 0}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-foreground-muted">
            Total revenue collected: <span className="font-semibold text-accent">₹{stats.totals.revenue}</span>
          </p>

          <div className="mt-6">
            <h2 className="text-lg font-semibold">Teams by Event</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-foreground-muted">
                  <tr>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Teams</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Pending</th>
                    <th className="px-3 py-2">Failed</th>
                    <th className="px-3 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byEvent.map((ev) => (
                    <tr
                      key={ev.event_id}
                      onClick={() => filterByEvent(ev.event_id)}
                      className="cursor-pointer border-t border-border hover:bg-raised"
                      title="Filter the teams list to this event"
                    >
                      <td className="px-3 py-2">{ev.event_name}</td>
                      <td className="px-3 py-2">{ev.teams}</td>
                      <td className="px-3 py-2 text-accent">{ev.paid ?? 0}</td>
                      <td className="px-3 py-2 text-primary">{ev.created ?? 0}</td>
                      <td className="px-3 py-2 text-red-400">{ev.failed ?? 0}</td>
                      <td className="px-3 py-2">₹{ev.revenue}</td>
                    </tr>
                  ))}
                  {stats.byEvent.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-foreground-muted" colSpan={6}>No registrations yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold">Teams</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mt-3 flex flex-wrap gap-3"
      >
        <input
          className={fieldClass}
          placeholder="Search name, roll, mobile, email, team, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={fieldClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="not_required">Not required</option>
          <option value="created">Created</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
        </select>
        <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-primary-light">
          Filter
        </button>
        <button type="button" onClick={handleExportCsv} className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary">
          Export CSV
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="mt-4 text-foreground-muted">Loading…</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Team Registrations</h3>
        <select className={fieldClass} value={teamEventFilter} onChange={(e) => setTeamEventFilter(e.target.value)}>
          <option value="">All team events</option>
          {teamEvents.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Team Name</th>
              <th className="px-3 py-2">Leader</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teamRows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.registration_code}</td>
                <td className="px-3 py-2">{r.team_name || "—"}</td>
                <td className="px-3 py-2">{r.leader_name || "—"}</td>
                <td className="px-3 py-2">{r.event_name}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[r.payment_status] ?? ""}`}>
                    {r.payment_status}
                  </span>
                </td>
                <td className="px-3 py-2">{r.team_size}</td>
                <td className="px-3 py-2">
                  <ScoreCell registration={r} busy={busyId === r.id} onSave={(score) => handleSetScore(r.id, score)} />
                </td>
                <td className="px-3 py-2">
                  <RegistrationActions
                    registration={r}
                    busy={busyId === r.id}
                    onConfirm={() => handleConfirm(r.id)}
                    onReject={() => handleReject(r.id)}
                    onAddMember={() => setAddMemberFor(r)}
                    onDelete={() => handleDelete(r.id)}
                  />
                </td>
              </tr>
            ))}
            {teamRows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-foreground-muted" colSpan={8}>No team registrations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Solo Registrations</h3>
        <select className={fieldClass} value={soloEventFilter} onChange={(e) => setSoloEventFilter(e.target.value)}>
          <option value="">All solo events</option>
          {soloEvents.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">College</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {soloRows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.registration_code}</td>
                <td className="px-3 py-2">{r.leader_name || "—"}</td>
                <td className="px-3 py-2">{r.leader_college || "—"}</td>
                <td className="px-3 py-2">{r.event_name}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[r.payment_status] ?? ""}`}>
                    {r.payment_status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ScoreCell registration={r} busy={busyId === r.id} onSave={(score) => handleSetScore(r.id, score)} />
                </td>
                <td className="px-3 py-2">
                  <RegistrationActions
                    registration={r}
                    busy={busyId === r.id}
                    onConfirm={() => handleConfirm(r.id)}
                    onReject={() => handleReject(r.id)}
                    onAddMember={() => setAddMemberFor(r)}
                    onDelete={() => handleDelete(r.id)}
                  />
                </td>
              </tr>
            ))}
            {soloRows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-foreground-muted" colSpan={7}>No solo registrations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addMemberFor && (
        <AddMemberModal
          registration={addMemberFor}
          onClose={() => setAddMemberFor(null)}
          onDone={() => {
            setAddMemberFor(null);
            load();
            loadStats();
          }}
        />
      )}
    </section>
  );
}

function RegistrationActions({ registration, busy, onConfirm, onReject, onAddMember, onDelete }) {
  return (
    <div className="flex flex-wrap gap-2">
      {registration.payment_status === "created" && (
        <>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent hover:bg-accent/25"
          >
            Confirm
          </button>
          <button
            disabled={busy}
            onClick={onReject}
            className="rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-400 hover:bg-red-500/25"
          >
            Reject
          </button>
        </>
      )}
      <button
        onClick={onAddMember}
        className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
      >
        + Member
      </button>
      <button
        disabled={busy}
        onClick={onDelete}
        className="rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-400 hover:bg-red-500/25"
      >
        Delete
      </button>
    </div>
  );
}

function ScoreCell({ registration, busy, onSave }) {
  const [value, setValue] = useState(registration.score ?? "");

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        className="w-20 rounded-lg border border-border bg-raised px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        disabled={busy || value === ""}
        onClick={() => onSave(Number(value))}
        className="rounded-full border border-border px-2 py-1 text-xs hover:border-primary disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}

function AddMemberModal({ registration, onClose, onDone }) {
  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addTeamMember(registration.id, { fullName, rollNumber, mobile, email });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold">Add member to {registration.team_name || registration.registration_code}</h3>
        <div className="mt-4 space-y-3">
          <input className={`${fieldClass} w-full`} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input className={`${fieldClass} w-full`} placeholder="Roll number" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required />
          <input className={`${fieldClass} w-full`} placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
          <input className={`${fieldClass} w-full`} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-primary-light disabled:opacity-50">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
