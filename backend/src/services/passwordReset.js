import jwt from "jsonwebtoken";
import { requireEnvInt } from "../utils/env.js";

const RECOVERY_TOKEN_TTL_MS = requireEnvInt("RECOVERY_TOKEN_TTL_MS");

// secret is caller-provided (not hardcoded) so an admin-purpose token is always
// signed with JWT_ADMIN_SECRET and a participant-purpose token with
// JWT_PARTICIPANT_SECRET — same secret separation participantAuth.js relies on.
export function issueRecoveryToken({ purpose, subjectId, invalidateWith, secret }) {
  return jwt.sign({ purpose, subjectId, invalidateWith }, secret, {
    expiresIn: Math.floor(RECOVERY_TOKEN_TTL_MS / 1000),
  });
}

export function verifyRecoveryToken(token, expectedPurpose, secret) {
  const payload = jwt.verify(token, secret);
  if (payload.purpose !== expectedPurpose) throw new Error("Wrong token purpose");
  return payload;
}
