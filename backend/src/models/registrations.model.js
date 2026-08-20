import { pool } from "../db/pool.js";

export async function getRegistrationByCode(code) {
  const [[registration]] = await pool.query("SELECT * FROM registrations WHERE registration_code = ?", [code]);
  return registration;
}

export async function getRegistrationById(id) {
  const [[registration]] = await pool.query(
    `SELECT r.*, e.name AS event_name, e.slug AS event_slug
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = ?`,
    [id]
  );
  return registration;
}

// Public leaderboard (Part — post-login portal) — only fields safe to show to
// anyone: team/leader name and score. No roll numbers, emails, or mobiles.
export async function getLeaderboard(eventId) {
  const [rows] = await pool.query(
    `SELECT r.id, r.team_name, r.score,
            (SELECT full_name FROM participants p WHERE p.registration_id = r.id AND p.participant_order = 1) AS leader_name
     FROM registrations r
     WHERE r.event_id = ? AND r.score IS NOT NULL
     ORDER BY r.score DESC`,
    [eventId]
  );
  return rows;
}

export async function setScore(registrationId, score, adminId) {
  await pool.query(
    "UPDATE registrations SET score = ?, score_updated_at = NOW(), score_updated_by = ? WHERE id = ?",
    [score, adminId, registrationId]
  );
}

export async function listParticipantsForRegistration(registrationId) {
  const [rows] = await pool.query(
    "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
    [registrationId]
  );
  return rows;
}

// Admin dashboard search/filter (Part 4) — searches across the fields an
// organizer would actually be handed at the door: name, roll number, mobile,
// email, team name, or the registration code itself.
export async function searchRegistrations({ search, eventId, paymentStatus }) {
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push(`(
      r.registration_code LIKE ? OR r.team_name LIKE ? OR
      EXISTS (
        SELECT 1 FROM participants p2 WHERE p2.registration_id = r.id AND (
          p2.full_name LIKE ? OR p2.roll_number LIKE ? OR p2.mobile LIKE ? OR p2.email LIKE ?
        )
      )
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }
  if (eventId) {
    clauses.push("r.event_id = ?");
    params.push(eventId);
  }
  if (paymentStatus) {
    clauses.push("r.payment_status = ?");
    params.push(paymentStatus);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT r.*, e.name AS event_name, e.slug AS event_slug,
            (SELECT full_name FROM participants p WHERE p.registration_id = r.id AND p.participant_order = 1) AS leader_name,
            (SELECT college FROM participants p WHERE p.registration_id = r.id AND p.participant_order = 1) AS leader_college
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

// Status-by-contact lookup (public /status page) — mirrors login's "any
// participant row" matching: every registration this person's email+mobile
// appears on, across all events, not just one team's roster.
export async function getRegistrationsForParticipant(email, mobile) {
  const [rows] = await pool.query(
    `SELECT DISTINCT r.id FROM registrations r
     JOIN participants p ON p.registration_id = r.id
     WHERE p.email = ? AND p.mobile = ?`,
    [email, mobile]
  );
  const results = [];
  for (const { id } of rows) {
    results.push({
      registration: await getRegistrationById(id),
      participants: await listParticipantsForRegistration(id),
    });
  }
  return results;
}

// Admin dashboard stats (payment counts + per-event breakdown) — one grouped
// query, reshaped into totals/byEvent by the controller.
export async function getRegistrationStats() {
  const [rows] = await pool.query(
    `SELECT r.event_id, e.name AS event_name, e.slug AS event_slug, r.payment_status,
            COUNT(*) AS count, SUM(r.registration_fee) AS revenue
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     GROUP BY r.event_id, e.name, e.slug, r.payment_status`
  );
  return rows;
}
