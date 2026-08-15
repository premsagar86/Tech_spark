import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applySchema() {
  // Connect without a target database first — DB_NAME may not exist yet on a first run.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME;
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await connection.query(sql);

  // CREATE TABLE IF NOT EXISTS above won't add new columns to a table that
  // already existed before this column was introduced — migrate it here.
  // No version-safe `ADD COLUMN IF NOT EXISTS` across MySQL versions, so
  // just attempt it and ignore "column already exists".
  try {
    await connection.query(
      "ALTER TABLE admins ADD COLUMN role ENUM('admin','scanner') NOT NULL DEFAULT 'admin'"
    );
    console.log("Migrated: added admins.role");
  } catch (err) {
    if (err.code !== "ER_DUP_FIELDNAME") throw err;
  }

  await connection.end();
  console.log(`Schema applied to \`${dbName}\`.`);
}

applySchema().catch((err) => {
  console.error("Failed to apply schema:", err.message);
  process.exit(1);
});
