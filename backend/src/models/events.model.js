import { pool } from "../db/pool.js";

export async function listEvents() {
  const [rows] = await pool.query("SELECT * FROM events ORDER BY event_date ASC");
  return rows;
}

export async function getEventBySlug(slug) {
  const [[event]] = await pool.query("SELECT * FROM events WHERE slug = ?", [slug]);
  return event;
}
