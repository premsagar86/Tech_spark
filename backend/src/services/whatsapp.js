import twilio from "twilio";

// Constructed lazily, not at import time — the Twilio SDK validates
// TWILIO_ACCOUNT_SID's format eagerly and throws if it isn't set to a real
// "AC..." sid yet, which would otherwise crash server boot before any local
// dev credentials are configured.
let client;
function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

export async function sendPaymentConfirmationWhatsApp(leader, registration) {
  if (!leader.mobile) return;
  await getClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:+91${leader.mobile}`,
    body: `TechSpark 2026: Payment confirmed for "${registration.team_name ?? leader.full_name}" (${registration.registration_code}). View your QR: ${process.env.FRONTEND_URL}/status?code=${registration.registration_code}`,
  });
}
