import { motion } from "motion/react";
import EventIcon from "./EventIcon.jsx";

export function isEventCompleted(event) {
  return new Date() >= new Date(event.event_date);
}

const difficultyColor = {
  Easy: "text-accent",
  Medium: "text-primary",
  Hard: "text-primary-light",
};

export default function EventCard({ event, onOpen }) {
  const completed = isEventCompleted(event);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="flex flex-col rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary/40"
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full text-primary"
        style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(0,212,255,0.15))" }}
      >
        <EventIcon event={event} />
      </div>

      <div className="mt-4 flex items-start justify-between">
        <h3 className="font-body text-xl font-semibold normal-case tracking-normal">{event.name}</h3>
        {event.fee > 0 ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            ₹{event.fee}
          </span>
        ) : (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Free</span>
        )}
      </div>
      <p className="mt-1 text-sm text-foreground-muted">{event.subtitle}</p>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-foreground-muted">
        <span>
          Team: {event.min_team_size === event.max_team_size
            ? event.min_team_size
            : `${event.min_team_size}-${event.max_team_size}`}
        </span>
        <span className={difficultyColor[event.difficulty] ?? ""}>{event.difficulty}</span>
        {event.duration && <span>{event.duration}</span>}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onOpen(event)}
          className="flex-1 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-primary hover:text-primary"
        >
          Details
        </button>
        {completed ? (
          <span className="flex-1 rounded-full border border-border px-4 py-2 text-center text-sm text-foreground-muted">
            Event Completed
          </span>
        ) : (
          <a
            href={`/register?event=${event.slug}`}
            className="flex-1 rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-background hover:bg-primary-light"
          >
            Register
          </a>
        )}
      </div>
    </motion.div>
  );
}
