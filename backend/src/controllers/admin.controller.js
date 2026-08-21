import { pool } from "../db/pool.js";
import { confirmPayment } from "../services/confirmPayment.js";
import { searchRegistrations, getRegistrationById, getRegistrationStats, setScore } from "../models/registrations.model.js";
import { getParticipantByCheckInCode, getParticipantById } from "../models/participants.model.js";
import {
  isValidFullName,
  isValidRollNumber,
  isValidEmail,
  isValidMobile,
  normalizeEmail,
  normalizeMobile,
} from "../utils/validators.js";
import { checkRegistrationEligibility, duplicateKeyMessage } from "../services/eligibility.js";
import { adminRefreshCookieOptions, adminSessionHintCookieOptions, adminTokenCookieOptions } from "../middleware/adminAuth.js";
import { revokeRefreshToken } from "../services/refreshTokens.js";

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function logoutAdmin(req, res) {
  await revokeRefreshToken("admin", req.cookies?.adminRefreshToken);
  res.clearCookie("adminToken", adminTokenCookieOptions());
  res.clearCookie("adminRefreshToken", adminRefreshCookieOptions());
  res.clearCookie("adminSessionHint", adminSessionHintCookieOptions());
  res.json({ ok: true });
}

export async function listRegistrations(req, res, next) {
  try {
    const { search, eventId, paymentStatus, format } = req.query;
    const rows = await searchRegistrations({ search, eventId, paymentStatus });

    if (format === "csv") {
      const header = "registration_code,team_name,leader_name,leader_college,event_name,payment_status,team_size,registration_fee,created_at";
      const lines = rows.map((r) =>
        [r.registration_code, r.team_name ?? "", r.leader_name ?? "", r.leader_college ?? "", r.event_name, r.payment_status, r.team_size, r.registration_fee, r.created_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [header, ...lines].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=registrations.csv");
      return res.send(csv);
    }

    res.json({ registrations: rows });
  } catch (err) {
    next(err);
  }
}

// Dashboard summary: payment counts overall + a per-event breakdown, so an
// admin can see "how many teams for event X, how many paid" without having
// to filter one event at a time.
export async function getStats(req, res, next) {
  try {
    const rows = await getRegistrationStats();

    const totals = { teams: 0, paid: 0, created: 0, failed: 0, not_required: 0, revenue: 0 };
    const byEventMap = new Map();

    for (const row of rows) {
      const count = Number(row.count);
      const revenue = row.payment_status === "paid" ? Number(row.revenue) || 0 : 0;

      totals.teams += count;
      totals[row.payment_status] = (totals[row.payment_status] ?? 0) + count;
      totals.revenue += revenue;

      if (!byEventMap.has(row.event_id)) {
        byEventMap.set(row.event_id, {
          event_id: row.event_id,
          event_name: row.event_name,
          event_slug: row.event_slug,
          teams: 0,
          paid: 0,
          created: 0,
          failed: 0,
          not_required: 0,
          revenue: 0,
        });
      }
      const entry = byEventMap.get(row.event_id);
      entry.teams += count;
      entry[row.payment_status] = (entry[row.payment_status] ?? 0) + count;
      entry.revenue += revenue;
    }

    res.json({ totals, byEvent: [...byEventMap.values()] });
  } catch (err) {
    next(err);
  }
}

// Manual override for edge cases (e.g. webhook + signature both somehow
// failed) — an admin should sanity-check the order's real status in the
// Razorpay dashboard before using either of these (Part 4).
export async function setRegistrationScore(req, res, next) {
  try {
    const registration = await getRegistrationById(req.params.id);
    if (!registration) return res.status(404).json({ error: "Registration not found" });

    const score = Number(req.body.score);
    if (!Number.isFinite(score)) throw httpError(400, "Score must be a number");

    await setScore(registration.id, score, req.admin.adminId);
    res.json({ ok: true, score });
  } catch (err) {
    next(err);
  }
}

export async function confirmPaymentOverride(req, res, next) {
  try {
    const registration = await getRegistrationById(req.params.id);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    await confirmPayment(registration.id, { confirmedByAdminId: req.admin.adminId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function rejectPaymentOverride(req, res, next) {
  try {
    const registration = await getRegistrationById(req.params.id);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    await pool.query("UPDATE registrations SET payment_status = 'failed' WHERE id = ?", [registration.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Hard delete — participants cascade automatically via the FK in schema.sql
// (ON DELETE CASCADE). Available regardless of payment_status, unlike Reject,
// since this is for removing a mistaken/duplicate/spam entry outright rather
// than marking a specific payment outcome.
export async function deleteRegistration(req, res, next) {
  try {
    const registration = await getRegistrationById(req.params.id);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    await pool.query("DELETE FROM registrations WHERE id = ?", [registration.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Add a team member to an existing registration (Part 4), capped at
// event.max_team_size, rejecting duplicate roll numbers the same way
// registration time does.
export async function addTeamMember(req, res, next) {
  const { id } = req.params;
  const { fullName, rollNumber, mobile, email } = req.body;
  const conn = await pool.getConnection();
  let newParticipantOrder;

  try {
    await conn.beginTransaction();

    if (!isValidFullName(fullName) || !isValidRollNumber(rollNumber)) {
      throw httpError(400, "Name must be at least 3 letters (alphabets only) and roll number must be alphanumeric");
    }
    if (!isValidEmail(email) || !isValidMobile(mobile)) {
      throw httpError(400, "A valid email and 10-digit mobile number are required");
    }
    const normalizedEmail = normalizeEmail(email);
    const normalizedMobile = normalizeMobile(mobile);

    const [[registration]] = await conn.query("SELECT * FROM registrations WHERE id = ? FOR UPDATE", [id]);
    if (!registration) throw httpError(404, "Registration not found");

    const [[event]] = await conn.query("SELECT * FROM events WHERE id = ?", [registration.event_id]);
    const [existing] = await conn.query(
      "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
      [id]
    );

    if (existing.length >= event.max_team_size) {
      throw httpError(400, `Team is already at the maximum size of ${event.max_team_size}`);
    }

    const college = existing[0]?.college ?? null;
    await checkRegistrationEligibility(conn, event, [
      { fullName, rollNumber, college, email: normalizedEmail, mobile: normalizedMobile },
    ]);

    newParticipantOrder = existing.length + 1;
    await conn.query(
      `INSERT INTO participants
         (registration_id, event_id, participant_order, full_name, roll_number, college, mobile, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, registration.event_id, newParticipantOrder, fullName, rollNumber, college, normalizedMobile, normalizedEmail]
    );
    await conn.query("UPDATE registrations SET team_size = ? WHERE id = ?", [newParticipantOrder, id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: duplicateKeyMessage(err) });
    }
    return next(err);
  } finally {
    conn.release();
  }

  // Payment already settled — backfill just the new member. Safe to re-run:
  // existing participants' codes recompute to the same value and are already
  // marked notified, so only the new member gets a check-in code + email.
  const registration = await getRegistrationById(id);
  if (registration.payment_status === "paid" || registration.payment_status === "not_required") {
    await confirmPayment(id);
  }

  res.status(201).json({ ok: true });
}

// Event check-in scanning (Part 6) — three outcomes: code doesn't exist,
// code exists but payment isn't settled, or code exists and is authorized.
export async function verifyCheckInCode(req, res, next) {
  try {
    const participant = await getParticipantByCheckInCode(req.params.code);
    if (!participant) return res.status(404).json({ error: "NO TEAM REGISTERED" });

    const registration = await getRegistrationById(participant.registration_id);
    const authorized = registration.payment_status === "paid" || registration.payment_status === "not_required";

    const teamMembers = await pool.query(
      "SELECT id, full_name, roll_number, check_in_code, checked_in, checked_in_at FROM participants WHERE registration_id = ? ORDER BY participant_order",
      [registration.id]
    ).then(([rows]) => rows);

    res.json({
      authorized,
      teamName: registration.team_name,
      event_id: registration.event_id,
      paymentStatus: registration.payment_status,
      participants: teamMembers,
    });
  } catch (err) {
    next(err);
  }
}

// Row-locked (Part 3 concurrency note) — two scanner devices checking the
// same person in at once can't both "succeed."
export async function checkInParticipant(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[participant]] = await conn.query("SELECT * FROM participants WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!participant) throw httpError(404, "Participant not found");

    if (participant.checked_in) {
      await conn.rollback();
      return res.status(409).json({
        error: "Already checked in",
        checkedInAt: participant.checked_in_at,
      });
    }

    await conn.query(
      "UPDATE participants SET checked_in = TRUE, checked_in_at = NOW(), checked_in_by = ? WHERE id = ?",
      [req.admin.adminId, participant.id]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}
