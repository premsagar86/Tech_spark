import { useRef } from "react";
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
          <div key={p.name} className="rounded-xl border border-border bg-surface p-6 text-center">
            {p.photo ? (
              <img
                src={p.photo}
                alt={p.name}
                className="mx-auto h-36 w-36 rounded-full object-cover"
              />
            ) : (
              <div className="mx-auto h-36 w-36 rounded-full bg-raised" />
            )}
            <h3 className="mt-4 font-body text-lg font-semibold normal-case tracking-normal">{p.name}</h3>
            <p className="text-sm text-primary">{p.role}</p>
            <p className="text-xs text-foreground-muted">{p.org}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
