import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { motion } from "motion/react";
import { scanResultBanner } from "../animations/motionVariants.js";
import { api } from "../lib/api.js";
import { useSession } from "../lib/session.js";

const SCANNER_ELEMENT_ID = "qr-reader";

export default function AdminScanner() {
  const { role } = useSession();
  const scannerRef = useRef(null);
  const [result, setResult] = useState(null); // { kind: 'not-found' | 'not-authorized' | 'authorized', ... }
  const [scanning, setScanning] = useState(false);
  const [checkingInId, setCheckingInId] = useState(null);
  const lastCodeRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          if (decodedText === lastCodeRef.current) return; // debounce repeat frames of the same code
          lastCodeRef.current = decodedText;
          await handleScan(decodedText);
        },
        () => {} // per-frame decode failure — ignore, expected while searching
      )
      .then(() => setScanning(true))
      .catch((err) => setResult({ kind: "camera-error", message: err.message }));

    return () => {
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan(code) {
    try {
      const data = await api.verifyCheckInCode(code);
      setResult({ kind: data.authorized ? "authorized" : "not-authorized", ...data });
    } catch (err) {
      if (err.message.includes("404") || /NO TEAM REGISTERED/i.test(err.message)) {
        setResult({ kind: "not-found" });
      } else {
        setResult({ kind: "error", message: err.message });
      }
    }
    setTimeout(() => {
      lastCodeRef.current = null;
    }, 2000);
  }

  async function markCheckedIn(participantId) {
    setCheckingInId(participantId);
    try {
      await api.checkInParticipant(participantId);
      setResult((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === participantId ? { ...p, checked_in: true, checked_in_at: new Date().toISOString() } : p
        ),
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      {role === "admin" && (
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-primary">
          ← Back to Dashboard
        </Link>
      )}
      <h1 className="text-center text-2xl">Check-in Scanner</h1>
      {!scanning && <p className="mt-2 text-center text-sm text-foreground-muted">Starting camera…</p>}

      <div id={SCANNER_ELEMENT_ID} className="mt-6 overflow-hidden rounded-xl border border-border" />

      {result?.kind === "not-found" && (
        <motion.div variants={scanResultBanner} initial="hidden" animate="visible" className="mt-6 rounded-xl bg-red-500/15 p-6 text-center">
          <p className="text-xl font-bold text-red-400">NO TEAM REGISTERED</p>
        </motion.div>
      )}

      {result?.kind === "camera-error" && (
        <div className="mt-6 rounded-xl bg-red-500/15 p-6 text-center text-red-400">
          Camera error: {result.message}
        </div>
      )}

      {result?.kind === "not-authorized" && (
        <motion.div variants={scanResultBanner} initial="hidden" animate="visible" className="mt-6 rounded-xl bg-primary/15 p-6">
          <p className="text-center text-lg font-bold text-primary">NOT AUTHORIZED — payment pending/failed</p>
          <p className="mt-2 text-center text-sm text-foreground-muted">{result.teamName || "Team"}</p>
        </motion.div>
      )}

      {result?.kind === "authorized" && (
        <motion.div variants={scanResultBanner} initial="hidden" animate="visible" className="mt-6 rounded-xl border border-accent/40 bg-accent/10 p-6">
          <p className="text-center text-lg font-bold text-accent">{result.teamName || "Individual entry"}</p>
          <div className="mt-4 space-y-2">
            {result.participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-raised px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{p.full_name}</div>
                  <div className="text-xs text-foreground-muted">{p.roll_number}</div>
                </div>
                {p.checked_in ? (
                  <span className="text-xs text-foreground-muted">
                    Checked in {p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString() : ""}
                  </span>
                ) : (
                  <button
                    disabled={checkingInId === p.id}
                    onClick={() => markCheckedIn(p.id)}
                    className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                  >
                    Mark checked in
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </section>
  );
}
