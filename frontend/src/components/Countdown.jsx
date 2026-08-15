import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

function getTimeLeft(targetDate) {
  const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

// TODO: FEST_START should come from the earliest event.event_date once the
// events list has loaded, rather than this hardcoded placeholder.
const FEST_START = "2026-09-03T09:00:00";

export default function Countdown({ targetDate = FEST_START }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));
  const cardRefs = useRef([]);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  function handleTilt(e, el) {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(el, { rotateY: x * 12, rotateX: -y * 12, duration: 0.3, ease: "power2.out" });
  }

  function resetTilt(el) {
    gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.4, ease: "power2.out" });
  }

  const units = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="flex gap-3 [perspective:800px] md:gap-6">
      {units.map((u, i) => (
        <div
          key={u.label}
          ref={(el) => (cardRefs.current[i] = el)}
          onMouseMove={(e) => handleTilt(e, cardRefs.current[i])}
          onMouseLeave={() => resetTilt(cardRefs.current[i])}
          className="w-16 rounded-xl border border-border bg-raised px-2 py-3 text-center shadow-lg md:w-24 md:py-5"
        >
          <div className="font-display text-2xl text-primary md:text-4xl">
            {String(u.value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-foreground-muted md:text-xs">
            {u.label}
          </div>
        </div>
      ))}
    </div>
  );
}
