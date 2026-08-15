import { verifyWebhookSignature } from "../services/razorpay.js";
import { confirmPayment } from "../services/confirmPayment.js";
import { pool } from "../db/pool.js";

// Reliable fallback for the case where the browser closes/network drops
// between Razorpay confirming payment and the callback reaching the backend
// (Part 2, step 4). Handles both payment.captured (-> confirmPayment()) and
// payment.failed (-> explicit 'failed', never left stuck in 'created').
export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(req.body.toString());
    const orderId = event.payload?.payment?.entity?.order_id;
    const [[registration]] = await pool.query("SELECT * FROM registrations WHERE razorpay_order_id = ?", [orderId]);
    if (!registration) return res.status(200).send("ok");

    if (event.event === "payment.captured") {
      const paymentId = event.payload?.payment?.entity?.id;
      if (paymentId && !registration.razorpay_payment_id) {
        await pool.query("UPDATE registrations SET razorpay_payment_id = ? WHERE id = ?", [paymentId, registration.id]);
      }
      await confirmPayment(registration.id);
    } else if (event.event === "payment.failed") {
      await pool.query(
        "UPDATE registrations SET payment_status = 'failed' WHERE id = ? AND payment_status = 'created'",
        [registration.id]
      );
    }
    res.status(200).send("ok");
  } catch (err) {
    next(err);
  }
}
