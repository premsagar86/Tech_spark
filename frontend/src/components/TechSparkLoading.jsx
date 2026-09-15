import { useEffect, useState } from "react";
import HUDRings from "./HUDRings.jsx";

const STAGE_TIMINGS = [
  { stage: "glow", at: 0 },
  { stage: "logo", at: 400 },
  { stage: "rings", at: 1100 },
  { stage: "leaving", at: 2300 },
];
const FADE_MS = 550;

export default function TechSparkLoading() {
  const [stage, setStage] = useState("glow");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timers = STAGE_TIMINGS.slice(1).map(({ stage: s, at }) =>
      setTimeout(() => setStage(s), at)
    );
    const goneTimer = setTimeout(
      () => setGone(true),
      STAGE_TIMINGS[STAGE_TIMINGS.length - 1].at + FADE_MS
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(goneTimer);
    };
  }, []);

  if (gone) return null;

  const leaving = stage === "leaving";
  const showLogo = stage !== "glow";
  const showRings = stage === "rings" || leaving;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity ease-out ${
        leaving ? "pointer-events-none opacity-0 duration-500" : "opacity-100 duration-300"
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/15 blur-[160px]" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {showRings && (
            <HUDRings size="lg" className="absolute inset-0 h-full w-full" />
          )}

          <div
            className={`relative h-16 w-16 overflow-hidden rounded-full shadow-[0_0_30px_rgba(255,106,0,0.45)] transition-all duration-500 ${
              showLogo ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          >
            <img src="/image.png" alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        <p
          className={`font-display text-2xl tracking-wide transition-opacity duration-500 ${
            showLogo ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-gradient">TECHSPARK</span> 2026
        </p>

        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="motion-safe:animate-pulse-dot h-1.5 w-1.5 rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
