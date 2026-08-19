import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { getParticipantToken, clearParticipantToken, getParticipantId } from "../lib/session.js";
import { QRCanvas } from "./TeamCard.jsx";
import EventCard from "./EventCard.jsx";
import EventModal from "./EventModal.jsx";

const paymentStatusLabel = {
  not_required: "Free entry — confirmed",
  created: "Payment pending",
  paid: "Payment confirmed",
  failed: "Payment failed",
};

// Persistent "My Registration" card (Part 7) — shown on any page load when a
// valid participant token exists, no navigation or manual code entry required.
export default function MyRegistrationCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    if (!getParticipantToken()) {
      setLoading(false);
      return;
    }
    api
      .getMyRegistration()
      .then(setData)
      .catch(() => clearParticipantToken())
      .finally(() => setLoading(false));
    api.getEvents().then((d) => setEvents(d.events));
  }, []);

  // The Navbar's Logout button clears the token without a route change
  // (we're already on "/"), so this sibling component needs its own signal
  // to drop stale data instead of leaving the last-fetched QR on screen.
  useEffect(() => {
    function handleSessionChange() {
      if (!getParticipantToken()) setData(null);
    }
    window.addEventListener("ts2026-session-changed", handleSessionChange);
    return () => window.removeEventListener("ts2026-session-changed", handleSessionChange);
  }, []);

  if (loading) return null;
  if (!data) return null;

  const myParticipant = data.participants.find((p) => p.id === getParticipantId());
  const isSolo = data.participants.length === 1;
  const orderedParticipants = data.participants.slice().sort((a, b) => a.participant_order - b.participant_order);
  const leader = orderedParticipants.find((p) => p.participant_order === 1);
  const otherEvents = events.filter((e) => e.slug !== data.registration.event_slug);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h2 className="mb-1 text-lg font-semibold">My Registration</h2>

      {myParticipant && (
        <p className="mb-6 text-sm text-foreground-muted">
          {isSolo ? (
            <>
              Welcome, <span className="font-semibold text-foreground">{myParticipant.full_name}</span>! You're
              registered for <span className="font-semibold text-foreground">{data.registration.event_name}</span>.
            </>
          ) : (
            <>
              Welcome, Team{" "}
              <span className="font-semibold text-foreground">
                {data.registration.team_name || leader?.full_name}
              </span>
              ! Your team is registered for{" "}
              <span className="font-semibold text-foreground">{data.registration.event_name}</span>.
            </>
          )}
        </p>
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-body text-lg font-semibold normal-case tracking-normal text-primary">
              {data.registration.team_name || leader?.full_name}
            </h3>
            <div className="text-sm text-foreground-muted">{data.registration.registration_code}</div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              data.registration.payment_status === "paid" || data.registration.payment_status === "not_required"
                ? "bg-accent/15 text-accent"
                : data.registration.payment_status === "failed"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-primary/15 text-primary"
            }`}
          >
            {paymentStatusLabel[data.registration.payment_status] ?? data.registration.payment_status}
          </span>
        </div>

        <h4 className="mb-3 mt-6 text-sm font-semibold text-foreground-muted">QR Codes</h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {orderedParticipants.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <QRCanvas participant={p} size={140} />
              <div className="text-center text-xs">
                <div className="font-medium">{p.full_name}</div>
                {p.participant_order === 1 && <div className="text-primary">Team Leader</div>}
              </div>
            </div>
          ))}
        </div>

        <h4 className="mb-3 mt-8 text-sm font-semibold text-foreground-muted">Team Details</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedParticipants.map((p) => (
            <ParticipantDetailBox key={p.id} participant={p} />
          ))}
        </div>
      </div>

      <div className="mt-4 text-right">
        <Link to="/profile" className="text-sm text-primary hover:underline">
          Complete your profile →
        </Link>
      </div>

      {otherEvents.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-semibold">Other events you can join</h3>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {otherEvents.map((event) => (
              <EventCard key={event.id} event={event} onOpen={setActiveEvent} />
            ))}
          </div>
        </div>
      )}

      <EventModal event={activeEvent} onClose={() => setActiveEvent(null)} />
    </div>
  );
}

function ParticipantDetailBox({ participant }) {
  const isLeader = participant.participant_order === 1;

  return (
    <div
      className={`rounded-lg border p-4 ${isLeader ? "border-primary bg-primary/5" : "border-border bg-raised"}`}
    >
      {isLeader && (
        <span className="mb-2 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Team Leader
        </span>
      )}
      <div className="text-sm font-semibold">{participant.full_name}</div>
      <div className="text-xs text-foreground-muted">{participant.roll_number}</div>

      <div className="mt-2 space-y-0.5 text-xs text-foreground-muted">
        {isLeader && participant.college && <div>{participant.college}</div>}
        {isLeader && (participant.course || participant.branch) && (
          <div>
            {participant.course}
            {participant.course && participant.branch && " • "}
            {participant.branch}
          </div>
        )}
        {isLeader && participant.year && <div>{participant.year}</div>}
        {participant.mobile && <div>{participant.mobile}</div>}
        {participant.email && <div>{participant.email}</div>}
      </div>

      {participant.checked_in && (
        <div className="mt-2 text-xs text-accent">
          Checked in{participant.checked_in_at ? ` at ${new Date(participant.checked_in_at).toLocaleString()}` : ""}
        </div>
      )}
    </div>
  );
}
