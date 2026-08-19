import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

const fieldClass =
  "w-full max-w-xs rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(searchParams.get("event") ?? "");
  const [leaderboard, setLeaderboard] = useState(null);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getEvents().then((data) => {
      setEvents(data.events);
      if (!selectedSlug && data.events.length > 0) setSelectedSlug(data.events[0].slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    setLoading(true);
    setSearchParams({ event: selectedSlug });
    api
      .getLeaderboard(selectedSlug)
      .then((data) => {
        setLeaderboard(data.leaderboard);
        setEventName(data.event.name);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center text-3xl md:text-4xl">Leaderboard</h1>
      <p className="mt-2 text-center text-sm text-foreground-muted">
        Top scores for each event.
      </p>

      <div className="mt-8 flex justify-center">
        <select className={fieldClass} value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
          {events.map((ev) => (
            <option key={ev.slug} value={ev.slug}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {loading && <p className="text-center text-foreground-muted">Loading…</p>}

        {!loading && leaderboard && leaderboard.length === 0 && (
          <p className="text-center text-foreground-muted">No scores published yet for {eventName}.</p>
        )}

        {!loading && leaderboard && leaderboard.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-foreground-muted">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Team / Participant</th>
                  <th className="px-4 py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-2 font-semibold text-primary">{i + 1}</td>
                    <td className="px-4 py-2">{row.team_name || row.leader_name}</td>
                    <td className="px-4 py-2 text-right font-semibold">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
