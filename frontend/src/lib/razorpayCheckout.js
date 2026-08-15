// Loaded globally via the <script src="https://checkout.razorpay.com/v1/checkout.js"> tag in index.html.
// Only the public key id ever reaches the frontend — amount/order are set server-side.
export function openRazorpayCheckout({ orderId, keyId, amount, name, onSuccess, onDismiss }) {
  const rzp = new window.Razorpay({
    key: keyId,
    order_id: orderId,
    amount: Math.round(amount * 100),
    currency: "INR",
    name: "TechSpark 2026",
    description: name,
    theme: { color: "#ff6b00" },
    handler: onSuccess, // { razorpay_payment_id, razorpay_order_id, razorpay_signature }
    modal: { ondismiss: onDismiss },
  });
  rzp.open();
}
