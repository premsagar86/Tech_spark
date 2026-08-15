import { pool } from "../db/pool.js";

export async function getParticipantById(id) {
  const [[participant]] = await pool.query("SELECT * FROM participants WHERE id = ?", [id]);
  return participant;
}

export async function getParticipantByCheckInCode(code) {
  const [[participant]] = await pool.query("SELECT * FROM participants WHERE check_in_code = ?", [code]);
  return participant;
}

export async function getParticipantByEmailAndMobile(email, mobile) {
  const [[participant]] = await pool.query(
    "SELECT * FROM participants WHERE email = ? AND mobile = ?",
    [email, mobile]
  );
  return participant;
}

export async function getParticipantByEmail(email) {
  const [[participant]] = await pool.query("SELECT * FROM participants WHERE email = ?", [email]);
  return participant;
}
