import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getParticipantToken, clearParticipantToken, getParticipantId } from "../lib/session.js";
import TeamCard, { ParticipantQR } from "./TeamCard.jsx";

const fieldClass =
  "w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

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
  const isLeader = myParticipant?.participant_order === 1;
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

      {myParticipant && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="text-sm font-semibold text-primary">Your QR Code</span>
          <ParticipantQR participant={myParticipant} size={200} />
        </div>
      )}

      {isLeader && <TeamCard registration={data.registration} participants={data.participants} />}

      {myParticipant && <ProfileSection participant={myParticipant} />}
    </div>
  );
}

function ProfileSection({ participant }) {
  const [githubUrl, setGithubUrl] = useState(participant.github_url ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(participant.linkedin_url ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.updateMyProfile({ githubUrl, linkedinUrl });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-6 rounded-xl border border-border bg-surface p-6">
      <h3 className="font-semibold">Complete your profile</h3>
      <p className="mt-1 text-sm text-foreground-muted">
        Add your GitHub and LinkedIn so organizers and teammates can find you — completely optional, but recommended.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-foreground-muted">GitHub URL</label>
          <input
            className={fieldClass}
            placeholder="https://github.com/yourname"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-foreground-muted">LinkedIn URL</label>
          <input
            className={fieldClass}
            placeholder="https://linkedin.com/in/yourname"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-accent">Profile updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-background hover:bg-primary-light disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
