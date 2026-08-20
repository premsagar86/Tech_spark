import { pool } from "../db/pool.js";

export async function getAdminByEmailAndMobile(email, mobile) {
  const [[admin]] = await pool.query(
    "SELECT * FROM admins WHERE email = ? AND mobile = ?",
    [email, mobile]
  );
  return admin;
}

export async function getAdminById(id) {
  const [[admin]] = await pool.query("SELECT * FROM admins WHERE id = ?", [id]);
  return admin;
}
