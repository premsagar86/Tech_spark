import { pool } from "../db/pool.js";

const STALE_MINUTES = 30;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

// Abandoned checkouts left in 'created' permanently occupy a capacity slot
// (Part 2/Part 9) — flip anything older than STALE_MINUTES to 'failed' so
// max_registrations counts stay accurate.
async function expireStaleRegistrations() {
  try {
    const [result] = await pool.query(
      `UPDATE registrations
       SET payment_status = 'failed'
       WHERE payment_status = 'created'
         AND created_at < (NOW() - INTERVAL ? MINUTE)`,
      [STALE_MINUTES]
    );
    if (result.affectedRows > 0) {
      console.log(`Expired ${result.affectedRows} stale registration(s).`);
    }
  } catch (err) {
    console.error("expireStaleRegistrations failed:", err.message);
  }
}

export function startExpireStaleRegistrationsJob() {
  expireStaleRegistrations();
  setInterval(expireStaleRegistrations, CHECK_INTERVAL_MS);
}
