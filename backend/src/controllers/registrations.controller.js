import { pool } from "../db/pool.js";
import { registrationCodeFromId } from "../utils/generateCode.js";
import { confirmPayment } from "../services/confirmPayment.js";
import { createOrder, verifySignature } from "../services/razorpay.js";
import { getRegistrationByCode, listParticipantsForRegistration } from "../models/registrations.model.js";

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// The flagship example (Part 12) — transaction, row-locked capacity check,
// team-size validation, code generation from the auto-increment id, and the
// Razorpay order call happening only *after* commit (Part 2, step 3).
export async function createRegistration(req, res, next) {
  const { eventSlug, teamName, participants } = req.body;
  // Temporary: the raw payload for this route came back reported as empty/malformed
  // from a live client once with no reproduction locally — log it here until that's
  // tracked down, then remove.
  console.log("POST /api/registrations body:", JSON.stringify(req.body));
  let registrationId, registrationCode, event, paymentStatus, conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[evt]] = await conn.query("SELECT * FROM events WHERE slug = ? FOR UPDATE", [eventSlug]);
    if (!evt) throw httpError(404, "Event not found");
    event = evt;

    if (new Date() >= new Date(event.event_date)) {
      throw httpError(409, "Registration for this event is closed");
    }

    const teamSize = participants?.length ?? 0;
    if (teamSize < event.min_team_size || teamSize > event.max_team_size) {
      throw httpError(400, `Team size must be between ${event.min_team_size} and ${event.max_team_size}`);
    }

    for (const [i, p] of (participants ?? []).entries()) {
      if (!p || typeof p !== "object" || !p.fullName?.trim() || !p.rollNumber?.trim()) {
        throw httpError(400, `Participant ${i + 1} is missing required details (full name, roll number)`);
      }
    }

    if (event.max_registrations !== null) {
      const [[{ count }]] = await conn.query(
        `SELECT COUNT(*) AS count FROM registrations
         WHERE event_id = ? AND payment_status IN ('not_required','created','paid') FOR UPDATE`,
        [event.id]
      );
      if (count >= event.max_registrations) throw httpError(409, "Event is full");
    }

    paymentStatus = event.fee > 0 ? "created" : "not_required";

    // registration_code starts NULL (the column allows multiple NULLs under its
    // UNIQUE index) — never a shared placeholder value, which would otherwise
    // serialize every concurrent signup on the same collision (Part 3).
    const [regResult] = await conn.query(
      `INSERT INTO registrations (event_id, team_name, team_size, registration_fee, payment_status)
       VALUES (?, ?, ?, ?, ?)`,
      [event.id, teamName ?? null, teamSize, event.fee, paymentStatus]
    );
    registrationId = regResult.insertId;
    registrationCode = registrationCodeFromId(registrationId);
    await conn.query("UPDATE registrations SET registration_code = ? WHERE id = ?", [registrationCode, registrationId]);

    for (const [i, p] of participants.entries()) {
      await conn.query(
        `INSERT INTO participants
           (registration_id, event_id, participant_order, full_name, roll_number, college, course, branch, year, mobile, email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [registrationId, event.id, i + 1, p.fullName, p.rollNumber,
         p.college ?? null, p.course ?? null, p.branch ?? null, p.year ?? null, p.mobile ?? null, p.email ?? null]
      );
    }

    await conn.commit();
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "One or more roll numbers are already registered for this event" });
    }
    return next(err);
  } finally {
    if (conn) conn.release();
  }

  if (paymentStatus === "not_required") {
    try {
      const result = await confirmPayment(registrationId);
      return res.status(201).json({
        registrationCode,
        paymentRequired: false,
        participantToken: result.participantToken,
      });
    } catch (err) {
      return next(err);
    }
  }

  // Outside the transaction, on purpose — an external HTTP call has no
  // business holding a DB connection/lock open.
  try {
    const order = await createOrder({ amount: event.fee, receipt: registrationCode });
    await pool.query("UPDATE registrations SET razorpay_order_id = ? WHERE id = ?", [order.id, registrationId]);
    return res.status(201).json({
      registrationCode,
      paymentRequired: true,
      razorpayOrderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: event.fee,
    });
  } catch (err) {
    await pool.query("UPDATE registrations SET payment_status = 'failed' WHERE id = ?", [registrationId]);
    return next(httpError(502, "Could not initialize payment, please try again"));
  }
}

export async function getRegistrationStatus(req, res, next) {
  try {
    const registration = await getRegistrationByCode(req.params.code);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    const participants = await listParticipantsForRegistration(registration.id);
    res.json({ registration, participants });
  } catch (err) {
    next(err);
  }
}

// Razorpay Checkout success callback — the client's own claim of success is
// never trusted alone; the HMAC signature is verified server-side (Part 2,
// step 4), and only a valid signature triggers confirmPayment().
export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const registration = await getRegistrationByCode(req.params.code);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    if (registration.razorpay_order_id !== razorpay_order_id) {
      return res.status(400).json({ error: "Order mismatch" });
    }

    const valid = verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!valid) return res.status(400).json({ error: "Payment signature verification failed" });

    await pool.query(
      "UPDATE registrations SET razorpay_payment_id = ? WHERE id = ?",
      [razorpay_payment_id, registration.id]
    );
    const result = await confirmPayment(registration.id);
    res.json({ ok: true, participantToken: result.participantToken });
  } catch (err) {
    next(err);
  }
}

// Abandoned checkout (Part 2) — re-opens Checkout against the existing order,
// or mints a fresh one if the old one has gone stale/is unusable.
export async function retryPayment(req, res, next) {
  try {
    const registration = await getRegistrationByCode(req.params.code);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    if (registration.payment_status === "paid" || registration.payment_status === "not_required") {
      return res.status(409).json({ error: "This registration is already confirmed" });
    }

    // Failed registrations older than the purge grace period have had their
    // participant data wiped (see expireStaleRegistrations.js) — nothing left
    // to pay for.
    const participants = await listParticipantsForRegistration(registration.id);
    if (participants.length === 0) {
      return res.status(410).json({ error: "This registration has expired, please register again" });
    }

    const order = await createOrder({
      amount: registration.registration_fee,
      receipt: `${registration.registration_code}-retry-${Date.now()}`,
    });
    await pool.query(
      "UPDATE registrations SET razorpay_order_id = ?, payment_status = 'created' WHERE id = ?",
      [order.id, registration.id]
    );
    res.json({
      razorpayOrderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: registration.registration_fee,
    });
  } catch (err) {
    next(err);
  }
}
