import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { api } from "../lib/api.js";
import { stepSlide } from "../animations/motionVariants.js";
import StepPersonalDetails from "./steps/StepPersonalDetails.jsx";
import StepEventSelect from "./steps/StepEventSelect.jsx";
import StepTeamMembers from "./steps/StepTeamMembers.jsx";
import StepReviewPay from "./steps/StepReviewPay.jsx";

export default function RegistrationWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventParam = searchParams.get("event") ?? "";

  const [stepIndex, setStepIndex] = useState(0);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [personalDetails, setPersonalDetails] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(eventParam);
  const [teamInfo, setTeamInfo] = useState(null);

  useEffect(() => {
    api
      .getEvents()
      .then((data) => setEvents(data.events))
      .finally(() => setLoadingEvents(false));
  }, []);

  const selectedEvent = events.find((e) => e.slug === selectedSlug);
  const isSoloEvent = selectedEvent ? selectedEvent.max_team_size <= 1 : false;

  // Solo events have nothing to fill on the "team" step (it's just a no-op
  // "no team members" screen) — skip it and go straight to review.
  useEffect(() => {
    if (isSoloEvent) setTeamInfo({ teamName: "", members: [] });
  }, [isSoloEvent]);

  // The Events page always links here with ?event=slug already chosen — skip
  // the "pick an event" step in that case, only show it as a fallback for a
  // bare /register visit (e.g. a stale link) where nothing was pre-selected.
  const skipEventStep = Boolean(eventParam);
  const STEPS = skipEventStep
    ? isSoloEvent
      ? ["personal", "review"]
      : ["personal", "team", "review"]
    : isSoloEvent
      ? ["personal", "event", "review"]
      : ["personal", "event", "team", "review"];
  const step = STEPS[stepIndex];

  function goTo(index) {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
  }

  function handleComplete(registrationCode) {
    navigate(`/status?code=${registrationCode}`);
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center text-3xl md:text-4xl">Register</h1>

      <div className="mt-4 flex justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 w-10 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      <div className="mt-8">
        <AnimatePresence mode="wait">
          {step === "personal" && (
            <StepPersonalDetails
              key="personal"
              defaultValues={personalDetails}
              onBack={() => navigate("/events")}
              onNext={(data) => {
                setPersonalDetails(data);
                goTo(stepIndex + 1);
              }}
            />
          )}

          {step === "event" && (
            <StepEventSelect
              key="event"
              events={events}
              loading={loadingEvents}
              selectedSlug={selectedSlug}
              onNext={(slug) => {
                setSelectedSlug(slug);
                goTo(stepIndex + 1);
              }}
              onBack={() => goTo(stepIndex - 1)}
            />
          )}

          {step === "team" && skipEventStep && !loadingEvents && !selectedEvent && (
            <motion.div key="invalid-event" variants={stepSlide} initial="enter" animate="center" exit="exit">
              <p className="text-sm text-foreground-muted">
                That event link looks out of date. Please pick your event again.
              </p>
              <Link to="/events" className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-background hover:bg-primary-light">
                Back to Events
              </Link>
            </motion.div>
          )}

          {step === "team" && selectedEvent && (
            <StepTeamMembers
              key="team"
              event={selectedEvent}
              defaultValues={teamInfo}
              onNext={(data) => {
                setTeamInfo(data);
                goTo(stepIndex + 1);
              }}
              onBack={() => goTo(stepIndex - 1)}
            />
          )}

          {step === "review" && selectedEvent && personalDetails && teamInfo && (
            <StepReviewPay
              key="review"
              event={selectedEvent}
              personalDetails={personalDetails}
              teamInfo={teamInfo}
              onBack={() => goTo(stepIndex - 1)}
              onComplete={handleComplete}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
