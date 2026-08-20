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
    {
      // CREATE TABLE IF NOT EXISTS is idempotent on its own — no ER_DUP_FIELDNAME
      // to swallow, this just no-ops on every boot once the table exists.
      name: "refresh_tokens table",
      sql: `CREATE TABLE IF NOT EXISTS refresh_tokens (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              token_hash    CHAR(64)  NOT NULL UNIQUE,
              subject_type  ENUM('admin','participant') NOT NULL,
              subject_id    INT       NOT NULL,
              expires_at    TIMESTAMP NOT NULL,
              revoked_at    TIMESTAMP NULL,
              replaced_by   INT       NULL,
              created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (replaced_by) REFERENCES refresh_tokens(id)
            )`,
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
