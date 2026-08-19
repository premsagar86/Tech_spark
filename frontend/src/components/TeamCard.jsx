import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QRCanvas({ participant, size = 140 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && participant.check_in_code) {
      QRCode.toCanvas(canvasRef.current, participant.check_in_code, { width: size, margin: 1 });
    }
  }, [participant.check_in_code, size]);

  if (!participant.check_in_code) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded bg-surface text-center text-xs text-foreground-muted"
      >
        QR available once payment is confirmed
      </div>
    );
  }

  return <canvas ref={canvasRef} />;
}

export function ParticipantQR({ participant, size = 140 }) {
  const isLeader = participant.participant_order === 1;

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-lg border p-4 ${
        isLeader ? "border-primary bg-primary/5" : "border-border bg-raised"
      }`}
    >
      {isLeader && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Team Leader
        </span>
      )}

      <QRCanvas participant={participant} size={size} />

      <div className="text-center">
        <div className="text-sm font-semibold">{participant.full_name}</div>
        <div className="text-xs text-foreground-muted">{participant.roll_number}</div>
        {isLeader && (
          <div className="mt-1 space-y-0.5 text-xs text-foreground-muted">
            {participant.college && <div>{participant.college}</div>}
            {(participant.course || participant.branch) && (
              <div>
                {participant.course}
                {participant.course && participant.branch && " • "}
                {participant.branch}
              </div>
            )}
            {participant.year && <div>{participant.year}</div>}
          </div>
        )}
        {(participant.mobile || participant.email) && (
          <div className="mt-1 space-y-0.5 text-xs text-foreground-muted">
            {participant.mobile && <div>{participant.mobile}</div>}
            {participant.email && <div>{participant.email}</div>}
          </div>
        )}
        {participant.checked_in && (
          <div className="mt-1 text-xs text-accent">
            Checked in{participant.checked_in_at ? ` at ${new Date(participant.checked_in_at).toLocaleString()}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

const paymentStatusLabel = {
  not_required: "Free entry — confirmed",
  created: "Payment pending",
  paid: "Payment confirmed",
  failed: "Payment failed",
};

export default function TeamCard({ registration, participants, onRetryPayment }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-body text-lg font-semibold normal-case tracking-normal">
            {registration.team_name || participants[0]?.full_name}
          </h3>
          <div className="text-sm text-foreground-muted">{registration.registration_code}</div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            registration.payment_status === "paid" || registration.payment_status === "not_required"
              ? "bg-accent/15 text-accent"
              : registration.payment_status === "failed"
                ? "bg-red-500/15 text-red-400"
                : "bg-primary/15 text-primary"
          }`}
        >
          {paymentStatusLabel[registration.payment_status] ?? registration.payment_status}
        </span>
      </div>

      {registration.payment_status === "created" && onRetryPayment && (
        <button
          onClick={onRetryPayment}
          className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-primary-light"
        >
          Retry Payment
        </button>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {participants
          .slice()
          .sort((a, b) => a.participant_order - b.participant_order)
          .map((p) => (
            <ParticipantQR key={p.id} participant={p} />
          ))}
      </div>
    </div>
  );
}
