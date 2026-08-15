import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { openRazorpayCheckout } from "../lib/razorpayCheckout.js";
import TeamCard from "../components/TeamCard.jsx";

const fieldClass =
  "flex-1 rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

export default function Status() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e) {
    e?.preventDefault();
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getStatus(code.trim());
      setData(result);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("code")) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRetryPayment() {
    try {
      const order = await api.retryPayment(data.registration.registration_code);
      openRazorpayCheckout({
        orderId: order.razorpayOrderId,
        keyId: order.razorpayKeyId,
        amount: order.amount,
        name: data.registration.team_name ?? "TechSpark 2026",
        onSuccess: async (response) => {
          await api.verifyPayment(data.registration.registration_code, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          lookup();
        },
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center text-3xl md:text-4xl">Check Registration Status</h1>

      <form onSubmit={lookup} className="mt-6 flex gap-2">
        <input
          className={fieldClass}
          placeholder="Registration code (e.g. TS2026-000123)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" disabled={loading} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-background hover:bg-primary-light disabled:opacity-50">
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {data && (
        <div className="mt-8">
          <TeamCard
            registration={data.registration}
            participants={data.participants}
            onRetryPayment={data.registration.payment_status === "created" ? handleRetryPayment : undefined}
          />
        </div>
      )}
    </section>
  );
}
