import Razorpay from "razorpay";
import crypto from "crypto";

// Constructed lazily so a placeholder RAZORPAY_KEY_ID during local dev
// doesn't risk crashing server boot (consistent with whatsapp.js).
let razorpay;
function getClient() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}

export async function createOrder({ amount, receipt }) {
  return getClient().orders.create({ amount: Math.round(amount * 100), currency: "INR", receipt });
}

export function verifySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}
