import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { fadeIn, modalPanel } from "../animations/motionVariants.js";
import { isEventCompleted } from "./EventCard.jsx";
import EventIcon from "./EventIcon.jsx";

export default function EventModal({ event, onClose }) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalPanel}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary"
                  style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(0,212,255,0.15))" }}
                >
                  <EventIcon event={event} className="h-5 w-5" />
                </div>
                <h3 className="font-display text-2xl">{event.name}</h3>
              </div>
              <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-foreground-muted">{event.subtitle}</p>

            <p className="mt-4 text-sm text-foreground">{event.description}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-foreground-muted">Team size</span>
                <div>
                  {event.min_team_size === event.max_team_size
                    ? event.min_team_size
                    : `${event.min_team_size}-${event.max_team_size}`}
                </div>
              </div>
              <div>
                <span className="text-foreground-muted">Fee</span>
                <div>{event.fee > 0 ? `₹${event.fee} per team` : "Free"}</div>
              </div>
              <div>
                <span className="text-foreground-muted">Difficulty</span>
                <div>{event.difficulty}</div>
              </div>
              <div>
                <span className="text-foreground-muted">Duration</span>
                <div>{event.duration}</div>
              </div>
            </div>

            {Array.isArray(event.rules) && event.rules.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-foreground">Rules</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground-muted">
                  {event.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6">
              {isEventCompleted(event) ? (
                <span className="block rounded-full border border-border px-4 py-2 text-center text-sm text-foreground-muted">
                  Event Completed
                </span>
              ) : (
                <Link
                  to={`/register?event=${event.slug}`}
                  className="block rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-background hover:bg-primary-light"
                >
                  Register for {event.name}
                </Link>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
