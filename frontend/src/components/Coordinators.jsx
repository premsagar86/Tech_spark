import { useRef } from "react";
import { coordinators } from "../data/placeholderContent.js";
import { useScrollReveal } from "../animations/scrollReveal.js";

export default function Coordinators() {
  const ref = useRef(null);
  useScrollReveal(ref, { stagger: true });

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-center text-3xl md:text-4xl">Event Coordinators</h2>
      <div ref={ref} className="mt-8 grid gap-6 sm:grid-cols-4">
        {coordinators.map((c) => (
          <div key={c.name} className="rounded-xl border border-border bg-surface p-6 text-center">
            {c.photo ? (
              <img
                src={c.photo}
                alt={c.name}
                className="mx-auto h-36 w-36 rounded-full object-cover"
              />
            ) : (
              <div className="mx-auto h-36 w-36 rounded-full bg-raised" />
            )}
            <h3 className="font-body text-base font-semibold normal-case tracking-normal">{c.name}</h3>
            <p className="text-sm text-foreground-muted">{c.role}</p>
            <a href={`tel:${c.phone}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              {c.phone}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
