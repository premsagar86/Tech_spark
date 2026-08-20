import { pool } from "../db/pool.js";
import { checkInCodeFor } from "../utils/generateCode.js";
import { sendConfirmationEmail } from "./email.js";
import { issueParticipantToken } from "../middleware/participantAuth.js";
import { getRegistrationById } from "../models/registrations.model.js";

// The one shared, idempotent core that every payment-confirmation trigger
// (Razorpay signature verification, the Razorpay webhook, free-event submit,
// and admin add-team-member backfill) calls — must be safe to fire more than
// once for the same registration without double-generating anything.
export async function confirmPayment(registrationId, { confirmedByAdminId } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[registration]] = await conn.query("SELECT * FROM registrations WHERE id = ? FOR UPDATE", [registrationId]);
    if (!registration) throw new Error(`Registration ${registrationId} not found`);

    const [participants] = await conn.query(
      "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
      [registrationId]
    );

    // Safety net: participant PII gets purged for long-abandoned 'failed'
    // registrations (expireStaleRegistrations.js). If this ever fires against
    // a purged registration, fail loudly instead of silently marking a
    // roster-less registration as 'paid'.
    if (participants.length === 0) {
      throw new Error(`Registration ${registrationId} has no participants — cannot confirm payment`);
    }

    // Idempotency guard — handles the webhook-vs-client-callback race.
    if (participants.length > 0 && participants.every((p) => p.check_in_code !== null)) {
      await conn.commit();
    } else {
      for (const p of participants) {
        if (p.check_in_code) continue;
        const checkInCode = checkInCodeFor(registration.registration_code, p.participant_order);
        await conn.query("UPDATE participants SET check_in_code = ? WHERE id = ?", [checkInCode, p.id]);
      }

      await conn.query(
        `UPDATE registrations SET payment_status = 'paid', payment_confirmed_by = ?, payment_confirmed_at = NOW() WHERE id = ?`,
        [confirmedByAdminId ?? null, registrationId]
      );

      await conn.commit();
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Side effect, deliberately outside the transaction — an email failure
  // must never undo the payment confirmation. getRegistrationById joins
  // events, so the email template has the event name/slug without another query.
  const registration = await getRegistrationById(registrationId);
  const [participants] = await pool.query(
    "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
    [registrationId]
  );
  const leader = participants[0];
  const event = { name: registration.event_name, slug: registration.event_slug };

  // Not awaited on purpose — SMTP sends to an external relay are slow, and
  // callers (the registration HTTP response, the payment webhook, etc.)
  // shouldn't be held up waiting on them.
  sendConfirmationEmails(participants, registration, event).catch((err) =>
    console.error(`Confirmation email batch failed for registration ${registrationId}`, err)
  );

  return { registration, participants, participantToken: leader ? issueParticipantToken(leader) : null };
}

async function sendConfirmationEmails(participants, registration, event) {
  for (const p of participants) {
    if (!p.email || p.confirmation_email_sent_at) continue;
    try {
      await sendConfirmationEmail(p, registration, participants, event);
      await pool.query("UPDATE participants SET confirmation_email_sent_at = NOW() WHERE id = ?", [p.id]);
    } catch (err) {
      console.error(`Confirmation email failed for participant ${p.id}`, err);
    }
  }
}
