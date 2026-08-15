import { motion } from "motion/react";
import { stepSlide } from "../../animations/motionVariants.js";
import { isEventCompleted } from "../../components/EventCard.jsx";

export default function StepEventSelect({ events, loading, selectedSlug, onNext, onBack }) {
  function pick(slug) {
    onNext(slug);
  }

  return (
    <motion.div variants={stepSlide} initial="enter" animate="center" exit="exit">
      <h2 className="text-xl font-semibold">Choose your event</h2>

      {loading && <p className="mt-4 text-foreground-muted">Loading events…</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {events.map((event) => {
          const completed = isEventCompleted(event);
          const active = event.slug === selectedSlug;
          return (
            <button
              type="button"
              key={event.slug}
              disabled={completed}
              onClick={() => pick(event.slug)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                completed
                  ? "cursor-not-allowed border-border opacity-50"
                  : active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-raised hover:border-primary/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{event.name}</span>
                <span className="text-xs text-foreground-muted">
                  {event.fee > 0 ? `₹${event.fee}` : "Free"}
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                Team: {event.min_team_size === event.max_team_size
                  ? event.min_team_size
                  : `${event.min_team_size}-${event.max_team_size}`}
                {completed && " — Registration closed"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-between">
        <button type="button" onClick={onBack} className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
          Back
        </button>
      </div>
    </motion.div>
  );
}
