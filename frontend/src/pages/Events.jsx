import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import EventCard from "../components/EventCard.jsx";
import EventModal from "../components/EventModal.jsx";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    api
      .getEvents()
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">TechSpark 2026</span>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">
          Explore <span className="text-gradient">Events</span>
        </h1>
        <p className="mt-2 text-foreground-muted">
          Only Ideathon and Hackathon carry an entry fee — everything else is free.
        </p>
      </div>

      {loading && <p className="mt-8 text-center text-foreground-muted">Loading events…</p>}
      {error && <p className="mt-8 text-center text-red-400">{error}</p>}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onOpen={setActiveEvent} />
        ))}
      </div>

      <EventModal event={activeEvent} onClose={() => setActiveEvent(null)} />
    </section>
  );
}
