import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import Countdown from "./Countdown.jsx";
import { useScrollReveal } from "../animations/scrollReveal.js";
import { useSession } from "../lib/session.js";

export default function Hero() {
  const ref = useRef(null);
  useScrollReveal(ref, { stagger: true });

  const { role, loading } = useSession();
  const isLoggedIn = !loading && role != null;

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center gap-8 px-4 py-24 text-center">
      <div ref={ref} className="flex flex-col items-center gap-6">
        <h1 className="font-display text-5xl leading-0 md:text-7xl">
          <span className="text-gradient">TECHSPARK</span> 2026
        </h1>
        <hr className="w-full border-border" />
        <p className="max-w-xl text-foreground-muted">
          Powered by Minds – <span className="font-semibold text-gradient">The event is fueled by the creativity, intelligence, and talent of participants.</span></p>
        <p className="max-w-xl text-foreground-muted">
          Driven by Innovation – <span className="font-semibold text-gradient">The ultimate goal is to create new ideas, solve problems, and advance technology.</span></p>
        <hr className="w-full border-border" />
        <Countdown />

        {!isLoggedIn && (
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/events"
              className="inline-block rounded-full bg-primary px-8 py-3 font-semibold text-background shadow-lg shadow-primary/30 transition-colors hover:bg-primary-light"
            >
              Explore Events
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
