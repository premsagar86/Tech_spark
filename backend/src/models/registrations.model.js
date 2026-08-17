import { pool } from "../db/pool.js";

export async function getRegistrationByCode(code) {
  const [[registration]] = await pool.query("SELECT * FROM registrations WHERE registration_code = ?", [code]);
  return registration;
}

export async function getRegistrationById(id) {
  const [[registration]] = await pool.query("SELECT * FROM registrations WHERE id = ?", [id]);
  return registration;
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
    `SELECT r.*, e.name AS event_name, e.slug AS event_slug
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
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
