export default function GlowBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
    </div>
  );
}
