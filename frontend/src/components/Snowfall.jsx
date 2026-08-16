import { useMemo } from "react";

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function Snowfall({ count = 24, className = "" }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: randomBetween(0, 100),
        size: randomBetween(10, 20),
        duration: randomBetween(4, 9),
        delay: randomBetween(-9, 0),
        drift: randomBetween(-16, 16),
        opacity: randomBetween(0.5, 0.95),
      })),
    [count]
  );

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-visible ${className}`}>
      {flakes.map((f) => (
        <span
          key={f.id}
          className="absolute top-0 animate-snowfall text-foreground"
          style={{
            left: `${f.left}%`,
            fontSize: `${f.size}px`,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            "--flake-drift": `${f.drift}px`,
            "--flake-opacity": f.opacity,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
