import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { clearAdminToken } from "../lib/session.js";

const fieldClass =
  "rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

const statusBadge = {
  paid: "bg-accent/15 text-accent",
  not_required: "bg-accent/15 text-accent",
  created: "bg-primary/15 text-primary",
  failed: "bg-red-500/15 text-red-400",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [addMemberFor, setAddMemberFor] = useState(null);

  useEffect(() => {
    api.getEvents().then((data) => setEvents(data.events));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (eventId) params.eventId = eventId;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      const data = await api.listRegistrations(params);
      setRows(data.registrations);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("401") || /not authenticated|invalid or expired/i.test(err.message)) {
        clearAdminToken();
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm(id) {
    setBusyId(id);
    try {
      await api.confirmPaymentOverride(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    if (!confirm("Reject this payment? Double-check the order status in the Razorpay dashboard first.")) return;
    setBusyId(id);
    try {
      await api.rejectPaymentOverride(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExportCsv() {
    const params = {};
    if (search) params.search = search;
    if (eventId) params.eventId = eventId;
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
    clearAdminToken();
    api.adminLogout().catch(() => {});
    navigate("/admin/login");
  }

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mt-6 flex flex-wrap gap-3"
      >
        <input
          className={fieldClass}
          placeholder="Search name, roll, mobile, email, team, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={fieldClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">All events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
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

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-foreground-muted">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Team / Leader</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.registration_code}</td>
                <td className="px-3 py-2">{r.team_name || "—"}</td>
                <td className="px-3 py-2">{r.event_name}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[r.payment_status] ?? ""}`}>
                    {r.payment_status}
                  </span>
                </td>
                <td className="px-3 py-2">{r.team_size}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {r.payment_status === "created" && (
                      <>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => handleConfirm(r.id)}
                          className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent hover:bg-accent/25"
                        >
                          Confirm
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => handleReject(r.id)}
                          className="rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-400 hover:bg-red-500/25"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setAddMemberFor(r)}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
                    >
                      + Member
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
          }}
        />
      )}
    </section>
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
      await api.addTeamMember(registration.id, { fullName, rollNumber, mobile: mobile || undefined, email: email || undefined });
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
          <input className={`${fieldClass} w-full`} placeholder="Mobile (optional)" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <input className={`${fieldClass} w-full`} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
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
