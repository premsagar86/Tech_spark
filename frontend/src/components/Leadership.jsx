import { useRef } from "react";
import { motion } from "motion/react";
import { leadership } from "../data/placeholderContent.js";
import { useScrollReveal } from "../animations/scrollReveal.js";

export default function Leadership() {
  const ref = useRef(null);
  useScrollReveal(ref, { stagger: true });

  
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-center text-3xl md:text-4xl">Leadership</h2>
      <div ref={ref} className="mt-8 grid gap-6 sm:grid-cols-3">
        {leadership.map((p) => (
          <motion.div
            key={p.name}
            whileHover={{ y: -6 }}
            className="group rounded-xl border border-border bg-surface p-6 text-center transition-all duration-300 hover:border-primary/50 hover:bg-raised hover:shadow-[0_0_30px_-8px_rgba(255,107,0,0.4)]"
          >
            {p.photo ? (
              <img
                src={p.photo}
                alt={p.name}
                className="mx-auto h-36 w-36 rounded-full object-cover ring-2 ring-transparent transition-all duration-300 group-hover:scale-105 group-hover:ring-primary/60"
              />
            ) : (
              <div className="mx-auto h-36 w-36 rounded-full bg-raised ring-2 ring-transparent transition-all duration-300 group-hover:scale-105 group-hover:ring-primary/60" />
            )}
            <h3 className="mt-4 font-body text-lg font-semibold normal-case tracking-normal transition-colors group-hover:text-primary">{p.name}</h3>
            <p className="text-sm text-primary">{p.role}</p>
            <p className="text-xs text-foreground-muted">{p.org}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
