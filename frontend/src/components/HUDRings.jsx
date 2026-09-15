const SIZE_RING_COUNT = {
  sm: 2,
  lg: 3,
};

export default function HUDRings({
  size = "lg",
  spin = true,
  className = "",
}) {
  const ringCount = SIZE_RING_COUNT[size] ?? 2;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative ${className}`}
    >
      {Array.from({ length: ringCount }, (_, i) => (
        <span
          key={i}
          className={`absolute inset-0 rounded-full border ${
            i % 2 === 0 ? "border-accent/25" : "border-primary/20"
          } ${spin ? "motion-safe:animate-spin-glow" : ""}`}
          style={{
            inset: `${-i * 14}%`,
            animationDuration: `${6 + i * 4}s`,
            animationDirection: i % 2 === 0 ? "normal" : "reverse",
          }}
        />
      ))}
    </div>
  );
}
