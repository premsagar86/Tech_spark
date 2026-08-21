import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useSession, clearParticipantSession } from "../lib/session.js";

const fieldClass =
  "w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

export default function Profile() {
  const navigate = useNavigate();
  const { role, participantId, loading: sessionLoading } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (role !== "participant") {
      navigate("/login");
      return;
    }
    api
      .getMyRegistration()
      .then(setData)
      .catch(() => {
        clearParticipantSession();
        navigate("/login");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, role]);

  if (sessionLoading || loading) return null;
  if (!data) return null;

  const myParticipant = data.participants.find((p) => p.id === participantId);
  if (!myParticipant) return null;

  const isLeader = myParticipant.participant_order === 1;

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center text-3xl md:text-4xl">My Profile</h1>

      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="font-semibold">Your details</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail label="Full name" value={myParticipant.full_name} />
          <Detail label="Roll number" value={myParticipant.roll_number} />
          <Detail label="Event" value={data.registration.event_name} />
          {data.registration.team_name && <Detail label="Team" value={data.registration.team_name} />}
          {isLeader && <Detail label="College" value={myParticipant.college} />}
          {isLeader && <Detail label="Course" value={myParticipant.course} />}
          {isLeader && <Detail label="Branch" value={myParticipant.branch} />}
          {isLeader && <Detail label="Year" value={myParticipant.year} />}
          <Detail label="Mobile" value={myParticipant.mobile} />
          <Detail label="Email" value={myParticipant.email} />
        </dl>
      </div>

      <ProfileLinksForm participant={myParticipant} />
    </section>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function ProfileLinksForm({ participant }) {
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
      <h2 className="font-semibold">Update your links</h2>
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
