import { pool } from "../db/pool.js";

// ---- exams / questions ----------------------------------------------------

export async function getExamBySlug(slug) {
  const [[exam]] = await pool.query("SELECT * FROM exams WHERE slug = ?", [slug]);
  return exam;
}

export async function getExamById(id) {
  const [[exam]] = await pool.query("SELECT * FROM exams WHERE id = ?", [id]);
  return exam;
}

// Full rows including correct_answer — grading only, never sent to a candidate.
export async function listQuestions(examId) {
  const [rows] = await pool.query(
    "SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY order_index, id",
    [examId]
  );
  return rows;
}

// ---- attempts ----------------------------------------------------------

// Time math is done in SQL (DB/server clock) rather than round-tripping
// expires_at through a JS Date — mysql2 reads a DATETIME back in the connection
// timezone, which silently shifts it. `remaining_seconds` and `is_expired` are
// the values the rest of the code should use.
const ATTEMPT_TIME_COLS =
  "*, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds, (NOW() >= expires_at) AS is_expired";

export async function getAttemptById(id) {
  const [[attempt]] = await pool.query(`SELECT ${ATTEMPT_TIME_COLS} FROM exam_attempts WHERE id = ?`, [id]);
  return attempt;
}

export async function getAttemptForParticipant(examId, participantId) {
  const [[attempt]] = await pool.query(
    `SELECT ${ATTEMPT_TIME_COLS} FROM exam_attempts WHERE exam_id = ? AND participant_id = ?`,
    [examId, participantId]
  );
  return attempt;
}

export async function createAttempt({
  examId,
  participantId,
  tokenHash,
  signingKey,
  durationMinutes,
  ip,
  userAgent,
  extensionVersion,
}) {
  const [result] = await pool.query(
    `INSERT INTO exam_attempts
       (exam_id, participant_id, attempt_token_hash, signing_key, expires_at, ip, user_agent, extension_version)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?, ?)`,
    [
      examId,
      participantId,
      tokenHash,
      signingKey || null,
      durationMinutes,
      ip || null,
      userAgent || null,
      extensionVersion || null,
    ]
  );
  return getAttemptById(result.insertId);
}

export async function setAttemptTokenHash(id, tokenHash) {
  await pool.query("UPDATE exam_attempts SET attempt_token_hash = ? WHERE id = ?", [tokenHash, id]);
}

export async function markAttemptStatus(id, status) {
  await pool.query(
    `UPDATE exam_attempts
        SET status = ?, submitted_at = COALESCE(submitted_at, IF(? IN ('submitted','auto_submitted'), NOW(), submitted_at))
      WHERE id = ?`,
    [status, status, id]
  );
}

export async function setAutoScore(id, autoScore) {
  await pool.query("UPDATE exam_attempts SET auto_score = ? WHERE id = ?", [autoScore, id]);
}

export async function setManualScore(id, score, adminId) {
  await pool.query(
    "UPDATE exam_attempts SET score = ?, score_updated_at = NOW(), score_updated_by = ? WHERE id = ?",
    [score, adminId, id]
  );
}

// ---- answers ----------------------------------------------------------

export async function upsertAnswers(attemptId, entries) {
  if (!entries.length) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { questionId, answer } of entries) {
      await conn.query(
        `INSERT INTO exam_answers (attempt_id, question_id, answer)
         VALUES (?, ?, CAST(? AS JSON))
         ON DUPLICATE KEY UPDATE answer = VALUES(answer)`,
        [attemptId, questionId, JSON.stringify(answer ?? null)]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listAnswers(attemptId) {
  const [rows] = await pool.query(
    "SELECT question_id, answer, updated_at FROM exam_answers WHERE attempt_id = ?",
    [attemptId]
  );
  return rows;
}

// ---- proctor events ----------------------------------------------------

export async function insertEvents(attemptId, events) {
  if (!events.length) return;
  const values = events.map((e) => [
    attemptId,
    String(e.kind).slice(0, 40),
    e.severity === "warn" || e.severity === "strike" ? e.severity : "info",
    e.source === "extension" || e.source === "server" ? e.source : "sdk",
    JSON.stringify(e.detail ?? {}),
    Number.isFinite(e.seq) ? e.seq : null,
    Number.isFinite(e.clientTs) ? e.clientTs : null,
  ]);
  await pool.query(
    `INSERT INTO exam_events (attempt_id, kind, severity, source, detail, seq, client_ts)
     VALUES ?`,
    [values]
  );
}

export async function listEvents(attemptId) {
  const [rows] = await pool.query(
    "SELECT id, kind, severity, source, detail, seq, client_ts, server_ts FROM exam_events WHERE attempt_id = ? ORDER BY server_ts, id",
    [attemptId]
  );
  return rows;
}

// ---- admin ----------------------------------------------------------

export async function listAttemptsForExam(examId) {
  const [rows] = await pool.query(
    `SELECT a.*, p.full_name, p.roll_number, p.email,
            (SELECT COUNT(*) FROM exam_events e WHERE e.attempt_id = a.id AND e.severity = 'strike') AS strike_events,
            (SELECT COUNT(*) FROM exam_events e WHERE e.attempt_id = a.id) AS total_events
       FROM exam_attempts a
       JOIN participants p ON p.id = a.participant_id
      WHERE a.exam_id = ?
      ORDER BY FIELD(a.status, 'auto_submitted', 'in_progress', 'expired', 'submitted'), a.started_at DESC`,
    [examId]
  );
  return rows;
}
