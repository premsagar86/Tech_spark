import { pool } from "../db/pool.js";
import { checkInCodeFor } from "../utils/generateCode.js";
import { sendPaymentConfirmationWhatsApp } from "./whatsapp.js";
import { sendConfirmationEmail } from "./email.js";
import { issueParticipantToken } from "../middleware/participantAuth.js";

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

  // Side effects, deliberately outside the transaction and isolated from each
  // other — a WhatsApp or email failure must never undo the payment confirmation.
  const [[registration]] = await pool.query("SELECT * FROM registrations WHERE id = ?", [registrationId]);
  const [participants] = await pool.query(
    "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
    [registrationId]
  );
  const leader = participants[0];

  try {
    if (leader && !registration.notified_at) {
      await sendPaymentConfirmationWhatsApp(leader, registration);
      await pool.query("UPDATE registrations SET notified_at = NOW() WHERE id = ?", [registrationId]);
    }
  } catch (err) {
    console.error("WhatsApp send failed", err);
  }

  for (const p of participants) {
    if (!p.email || p.confirmation_email_sent_at) continue;
    try {
      await sendConfirmationEmail(p, registration, participants);
      await pool.query("UPDATE participants SET confirmation_email_sent_at = NOW() WHERE id = ?", [p.id]);
    } catch (err) {
      console.error(`Confirmation email failed for participant ${p.id}`, err);
    }
  }

  return { registration, participants, participantToken: leader ? issueParticipantToken(leader) : null };
}
