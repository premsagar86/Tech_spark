import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Fade + rise reveal for scroll-triggered sections (Part 10: GSAP + ScrollTrigger
// for scroll reveals, distinct from Motion's React-state-driven transitions).
export function useScrollReveal(ref, { y = 32, delay = 0, stagger } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = stagger ? el.children : el;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay,
          stagger: stagger ? 0.12 : 0,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 80%",
            once: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [ref, y, delay, stagger]);
}
