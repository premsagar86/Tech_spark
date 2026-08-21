import { useState } from "react";
import { motion } from "motion/react";
import { stepSlide } from "../../animations/motionVariants.js";
import { api } from "../../lib/api.js";
import { openRazorpayCheckout } from "../../lib/razorpayCheckout.js";
import { refreshSession } from "../../lib/session.js";

export default function StepReviewPay({ event, personalDetails, teamInfo, onBack, onComplete }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const allParticipants = [personalDetails, ...(teamInfo.members ?? [])];

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.register({
        eventSlug: event.slug,
        teamName: teamInfo.teamName || undefined,
        participants: allParticipants,
      });

      if (!result.paymentRequired) {
        await refreshSession();
        onComplete(result.registrationCode);
        return;
      }

      openRazorpayCheckout({
        orderId: result.razorpayOrderId,
        keyId: result.razorpayKeyId,
        amount: result.amount,
        name: event.name,
        onSuccess: async (response) => {
          try {
            const verifyResult = await api.verifyPayment(result.registrationCode, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await refreshSession();
          } catch (err) {
            setError(`Payment succeeded but confirmation failed: ${err.message}. Check /status with your code.`);
          } finally {
            onComplete(result.registrationCode);
          }
        },
        onDismiss: () => setSubmitting(false),
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <motion.div variants={stepSlide} initial="enter" animate="center" exit="exit">
      <h2 className="text-xl font-semibold">Review & confirm</h2>

      <div className="mt-4 rounded-lg border border-border bg-raised p-4">
        <div className="text-sm text-foreground-muted">Event</div>
        <div className="font-semibold">{event.name}</div>
        {teamInfo.teamName && (
          <>
            <div className="mt-2 text-sm text-foreground-muted">Team name</div>
            <div className="font-semibold">{teamInfo.teamName}</div>
          </>
        )}
        <div className="mt-2 text-sm text-foreground-muted">Fee</div>
        <div className="font-semibold">{event.fee > 0 ? `₹${event.fee} per team` : "Free"}</div>
      </div>

      <div className="mt-4 space-y-2">
        {allParticipants.map((p, i) => (
          <div key={i} className="rounded-lg border border-border p-3 text-sm">
            <span className="font-medium">{p.fullName}</span> — {p.rollNumber}
            {p.email ? ` — ${p.email}` : ""}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex justify-between">
        <button type="button" onClick={onBack} disabled={submitting} className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
          Back
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-full bg-primary px-6 py-2 font-semibold text-background hover:bg-primary-light disabled:opacity-50"
        >
          {submitting ? "Processing…" : event.fee > 0 ? "Proceed to Payment" : "Complete Registration"}
        </button>
      </div>
    </motion.div>
  );
}
