import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { getParticipantToken, clearParticipantToken, getParticipantId } from "../lib/session.js";
import TeamCard from "./TeamCard.jsx";

// Persistent "My Registration" card (Part 7) — shown on any page load when a
// valid participant token exists, no navigation or manual code entry required.
export default function MyRegistrationCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
  const leader = data.participants.find((p) => p.participant_order === 1);

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

      <TeamCard registration={data.registration} participants={data.participants} />

      <div className="mt-4 text-right">
        <Link to="/profile" className="text-sm text-primary hover:underline">
          Complete your profile →
        </Link>
      </div>
    </div>
  );
}
