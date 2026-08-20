import { pool } from "../db/pool.js";
import { requireEnvInt } from "./env.js";

const STALE_MINUTES = requireEnvInt("STALE_REGISTRATION_MINUTES");
const PURGE_GRACE_HOURS = requireEnvInt("PURGE_GRACE_HOURS");
const CHECK_INTERVAL_MS = requireEnvInt("STALE_CHECK_INTERVAL_MS");

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

// People who never paid shouldn't have their details sitting in the DB
// forever. Once a 'failed' registration has sat well past any reasonable
// retry window, wipe the participant PII it collected — but leave the
// registration row itself (no PII) intact for admin stats/CSV audit.
async function purgeFailedParticipantData() {
  try {
    const [result] = await pool.query(
      `DELETE p FROM participants p
       JOIN registrations r ON r.id = p.registration_id
       WHERE r.payment_status = 'failed'
         AND r.created_at < (NOW() - INTERVAL ? HOUR)`,
      [PURGE_GRACE_HOURS]
    );
    if (result.affectedRows > 0) {
      console.log(`Purged participant data for ${result.affectedRows} failed registration(s).`);
    }
  } catch (err) {
    console.error("purgeFailedParticipantData failed:", err.message);
  }
}

export function startExpireStaleRegistrationsJob() {
  expireStaleRegistrations();
  purgeFailedParticipantData();
  setInterval(() => {
    expireStaleRegistrations();
    purgeFailedParticipantData();
  }, CHECK_INTERVAL_MS);
}
