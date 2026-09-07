// Fixed banner that escalates as strikes accrue. Hidden at 0 strikes.
export default function StrikeBanner({ strikes, limit, lastKind }) {
  if (!strikes) return null;
  const atLimit = strikes >= limit;
  return (
    <div
      className={`sticky top-0 z-30 px-4 py-2 text-center text-sm font-semibold ${
        atLimit ? "bg-red-600 text-white" : "bg-yellow-500 text-black"
      }`}
    >
      {atLimit ? (
        <>Strike limit reached — submitting your test…</>
      ) : (
        <>
          Warning {strikes}/{limit}
          {lastKind ? ` — "${humanize(lastKind)}" detected.` : "."} Stay on this
          tab, in fullscreen.
        </>
      )}
    </div>
  );
}

function humanize(kind) {
  return String(kind).replace(/_/g, " ");
}
