import "dotenv/config";
import { pool } from "./pool.js";

// CLI: node src/db/create-admin.js <username> <email> <mobile> [role]
// No password — admins/scanners log in the same way participants do,
// identified by email+mobile (see src/controllers/auth.controller.js).
const [, , username, email, mobile, role = "admin"] = process.argv;

if (!username || !email || !mobile) {
  console.error("Usage: node src/db/create-admin.js <username> <email> <mobile> [admin|scanner]");
  process.exit(1);
}

if (role !== "admin" && role !== "scanner") {
  console.error(`Invalid role "${role}" — must be "admin" or "scanner".`);
  process.exit(1);
}

async function createAdmin() {
  await pool.query(
    "INSERT INTO admins (username, email, mobile, role) VALUES (?, ?, ?, ?)",
    [username, email, mobile, role]
  );
  console.log(`Admin "${username}" created with role "${role}".`);
  await pool.end();
}

createAdmin().catch((err) => {
  console.error("Failed to create admin:", err.message);
  process.exit(1);
});
