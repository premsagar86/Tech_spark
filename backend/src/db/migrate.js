import { pool } from "./pool.js";

// Idempotent column migrations for an already-deployed database — schema.sql's
// CREATE TABLE IF NOT EXISTS won't retroactively add a column to a table that
// already existed before that column was introduced. Run automatically on
// every server boot (server.js) so a schema change never again requires
// remembering to separately run this against production — a forgotten manual
// step here is exactly what caused the score-save 500s.
export async function migrateSchema() {
  const migrations = [
    {
      name: "admins.role",
      sql: "ALTER TABLE admins ADD COLUMN role ENUM('admin','scanner') NOT NULL DEFAULT 'admin'",
    },
    {
      name: "registrations.score*",
      sql: `ALTER TABLE registrations
              ADD COLUMN score DECIMAL(10,2) NULL,
              ADD COLUMN score_updated_at TIMESTAMP NULL,
              ADD COLUMN score_updated_by INT NULL,
              ADD FOREIGN KEY (score_updated_by) REFERENCES admins(id)`,
    },
    {
      name: "participants.github_url/linkedin_url",
      sql: "ALTER TABLE participants ADD COLUMN github_url VARCHAR(255) NULL, ADD COLUMN linkedin_url VARCHAR(255) NULL",
    },
  ];

  for (const { name, sql } of migrations) {
    try {
      await pool.query(sql);
      console.log(`Migrated: added ${name}`);
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") throw err;
    }
  }
}
