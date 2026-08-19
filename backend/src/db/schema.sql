-- TechSpark 2026 — database schema
-- Run once via `npm run db:schema` (backend/src/db/applySchema.js), which
-- creates/selects the database named by DB_NAME before running this file.

CREATE TABLE IF NOT EXISTS admins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  email          VARCHAR(150) NOT NULL UNIQUE,
  mobile         VARCHAR(10) NOT NULL UNIQUE,
  role           ENUM('admin','scanner') NOT NULL DEFAULT 'admin',
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  slug               VARCHAR(50)  NOT NULL UNIQUE,
  name               VARCHAR(100) NOT NULL,
  subtitle           VARCHAR(150),
  description        TEXT,
  min_team_size      INT          NOT NULL DEFAULT 1,
  max_team_size      INT          NOT NULL DEFAULT 1,
  fee                DECIMAL(8,2) NOT NULL DEFAULT 0,
  max_registrations  INT          NULL,
  event_date         DATETIME     NOT NULL,
  duration           VARCHAR(50),
  difficulty         ENUM('Easy','Medium','Hard') NOT NULL DEFAULT 'Easy',
  rules              JSON,
  created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registrations (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  registration_code     VARCHAR(20)  UNIQUE,
  event_id              INT          NOT NULL,
  team_name             VARCHAR(100),
  team_size             INT          NOT NULL,
  registration_fee      DECIMAL(8,2) NOT NULL DEFAULT 0,
  payment_status        ENUM('not_required','created','paid','failed') NOT NULL DEFAULT 'not_required',
  razorpay_order_id     VARCHAR(50),
  razorpay_payment_id   VARCHAR(50),
  payment_confirmed_by  INT NULL,
  payment_confirmed_at  TIMESTAMP NULL,
  notified_at           TIMESTAMP NULL,
  score                 DECIMAL(10,2) NULL,
  score_updated_at      TIMESTAMP NULL,
  score_updated_by      INT NULL,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (payment_confirmed_by) REFERENCES admins(id),
  FOREIGN KEY (score_updated_by) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS participants (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  registration_id     INT          NOT NULL,
  event_id            INT          NOT NULL,
  participant_order   INT          NOT NULL,
  full_name           VARCHAR(100) NOT NULL,
  roll_number         VARCHAR(50)  NOT NULL,
  college             VARCHAR(150),
  course              VARCHAR(50),
  branch              VARCHAR(50),
  year                VARCHAR(20),
  mobile              VARCHAR(10),
  email               VARCHAR(150),
  github_url          VARCHAR(255),
  linkedin_url        VARCHAR(255),
  check_in_code       VARCHAR(30)  UNIQUE,
  checked_in          BOOLEAN      NOT NULL DEFAULT FALSE,
  checked_in_at       TIMESTAMP    NULL,
  checked_in_by       INT          NULL,
  confirmation_email_sent_at  TIMESTAMP NULL,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (checked_in_by) REFERENCES admins(id),
  UNIQUE KEY uniq_reg_order (registration_id, participant_order),
  UNIQUE KEY uniq_event_roll (event_id, roll_number)
);
