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
      // Enforces one registration per event per email/mobile at the DB level,
      // backing up the application-level check in services/eligibility.js.
      // ER_DUP_KEYNAME means it's already applied (idempotent re-run).
      // ER_DUP_ENTRY means existing data already violates it — logged as a
      // warning rather than thrown, so it doesn't block later migrations in
      // this list; re-run `npm run db:schema` after the data is cleaned up.
      name: "participants.uniq_event_email/uniq_event_mobile",
      sql: `ALTER TABLE participants
              ADD UNIQUE KEY uniq_event_email (event_id, email),
              ADD UNIQUE KEY uniq_event_mobile (event_id, mobile)`,
      dupCode: ["ER_DUP_KEYNAME"],
      onDupEntry: "warn",
    },
    {
      // Data fix, not a schema change: confirmPayment() used to overwrite every
      // confirmed registration's status with 'paid', including free (fee 0)
      // events that should stay 'not_required'. Correct the historical rows.
      // Idempotent — after the first run no rows match, so re-runs no-op.
      name: "registrations.payment_status free-event backfill",
      sql: `UPDATE registrations SET payment_status = 'not_required'
            WHERE registration_fee = 0 AND payment_status = 'paid'`,
      dupCode: [],
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

    // --- Proctored entrance exam (mirrors schema.sql) -----------------------
    {
      name: "exams table",
      sql: `CREATE TABLE IF NOT EXISTS exams (
              id                 INT AUTO_INCREMENT PRIMARY KEY,
              slug               VARCHAR(60)  NOT NULL UNIQUE,
              title              VARCHAR(150) NOT NULL,
              event_id           INT          NULL,
              duration_minutes   INT          NOT NULL DEFAULT 60,
              strike_limit       INT          NOT NULL DEFAULT 3,
              require_extension  BOOLEAN      NOT NULL DEFAULT TRUE,
              require_camera     BOOLEAN      NOT NULL DEFAULT TRUE,
              shuffle_questions  BOOLEAN      NOT NULL DEFAULT FALSE,
              reveal_score       BOOLEAN      NOT NULL DEFAULT FALSE,
              opens_at           DATETIME     NULL,
              closes_at          DATETIME     NULL,
              created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (event_id) REFERENCES events(id)
            )`,
    },
    {
      name: "exam_questions table",
      sql: `CREATE TABLE IF NOT EXISTS exam_questions (
              id             INT AUTO_INCREMENT PRIMARY KEY,
              exam_id        INT          NOT NULL,
              type           ENUM('mcq','short','coding') NOT NULL DEFAULT 'mcq',
              prompt         TEXT         NOT NULL,
              options        JSON         NULL,
              correct_answer JSON         NULL,
              language       VARCHAR(30)  NULL,
              starter_code   TEXT         NULL,
              points         INT          NOT NULL DEFAULT 1,
              order_index    INT          NOT NULL DEFAULT 0,
              FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
            )`,
    },
    {
      name: "exam_attempts table",
      sql: `CREATE TABLE IF NOT EXISTS exam_attempts (
              id                 INT AUTO_INCREMENT PRIMARY KEY,
              exam_id            INT          NOT NULL,
              participant_id     INT          NOT NULL,
              attempt_token_hash CHAR(64)     NULL,
              signing_key        CHAR(64)     NULL,
              status             ENUM('in_progress','submitted','auto_submitted','expired') NOT NULL DEFAULT 'in_progress',
              strikes            INT          NOT NULL DEFAULT 0,
              auto_score         DECIMAL(10,2) NULL,
              score              DECIMAL(10,2) NULL,
              score_updated_at   TIMESTAMP    NULL,
              score_updated_by   INT          NULL,
              started_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
              submitted_at       TIMESTAMP    NULL,
              expires_at         DATETIME     NOT NULL,
              ip                 VARCHAR(45)  NULL,
              user_agent         TEXT         NULL,
              extension_version  VARCHAR(20)  NULL,
              FOREIGN KEY (exam_id) REFERENCES exams(id),
              FOREIGN KEY (participant_id) REFERENCES participants(id),
              FOREIGN KEY (score_updated_by) REFERENCES admins(id),
              UNIQUE KEY uniq_exam_participant (exam_id, participant_id)
            )`,
    },
    {
      name: "exam_answers table",
      sql: `CREATE TABLE IF NOT EXISTS exam_answers (
              id           INT AUTO_INCREMENT PRIMARY KEY,
              attempt_id   INT       NOT NULL,
              question_id  INT       NOT NULL,
              answer       JSON      NULL,
              updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
              FOREIGN KEY (question_id) REFERENCES exam_questions(id),
              UNIQUE KEY uniq_attempt_question (attempt_id, question_id)
            )`,
    },
    {
      name: "exam_events table",
      sql: `CREATE TABLE IF NOT EXISTS exam_events (
              id          INT AUTO_INCREMENT PRIMARY KEY,
              attempt_id  INT          NOT NULL,
              kind        VARCHAR(40)  NOT NULL,
              severity    ENUM('info','warn','strike') NOT NULL DEFAULT 'info',
              source      ENUM('sdk','extension','server') NOT NULL DEFAULT 'sdk',
              detail      JSON         NULL,
              seq         INT          NULL,
              client_ts   BIGINT       NULL,
              server_ts   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
              KEY idx_attempt (attempt_id, server_ts)
            )`,
    },
    {
      // For a DB where exam_attempts was created by an earlier build of this
      // migration, before signing_key was added to the CREATE above.
      name: "exam_attempts.signing_key",
      sql: "ALTER TABLE exam_attempts ADD COLUMN signing_key CHAR(64) NULL",
    },
  ];

  for (const { name, sql, dupCode = ["ER_DUP_FIELDNAME"], onDupEntry } of migrations) {
    try {
      await pool.query(sql);
      console.log(`Migrated: added ${name}`);
    } catch (err) {
      if (dupCode.includes(err.code)) continue;
      if (err.code === "ER_DUP_ENTRY" && onDupEntry === "warn") {
        console.warn(
          `Skipped migration "${name}": existing data violates the new constraint (${err.message}). ` +
            `Clean up the duplicate rows, then re-run \`npm run db:schema\`.`
        );
        continue;
      }
      throw err;
    }
  }
}
