import crypto from "crypto";
import { pool } from "../db/pool.js";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(subjectType, subjectId, ttlMs) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  const [result] = await pool.query(
    "INSERT INTO refresh_tokens (token_hash, subject_type, subject_id, expires_at) VALUES (?, ?, ?, ?)",
    [hashToken(token), subjectType, subjectId, expiresAt]
  );
  return { token, id: result.insertId };
}

// Validates + rotates a presented refresh token. If the token was already
// revoked (i.e. used before — a legitimate client always presents the newest
// one, so reuse means it leaked), the whole token family for that subject is
// revoked as a defensive response and rotation is refused.
export async function rotateRefreshToken(subjectType, rawToken, ttlMs) {
  const [[row]] = await pool.query(
    "SELECT * FROM refresh_tokens WHERE token_hash = ? AND subject_type = ?",
    [hashToken(rawToken), subjectType]
  );
  if (!row) return null;

  if (row.revoked_at || new Date(row.expires_at) < new Date()) {
    if (row.revoked_at) await revokeAllRefreshTokens(subjectType, row.subject_id);
    return null;
  }

  const { token, id } = await issueRefreshToken(subjectType, row.subject_id, ttlMs);
  await pool.query("UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = ? WHERE id = ?", [id, row.id]);
  return { token, subjectId: row.subject_id };
}

export async function revokeRefreshToken(subjectType, rawToken) {
  if (!rawToken) return;
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND subject_type = ? AND revoked_at IS NULL",
    [hashToken(rawToken), subjectType]
  );
}

export async function revokeAllRefreshTokens(subjectType, subjectId) {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE subject_type = ? AND subject_id = ? AND revoked_at IS NULL",
    [subjectType, subjectId]
  );
}
