import jwt from "jsonwebtoken";

// secret is caller-provided (not hardcoded) so an admin-purpose token is always
// signed with JWT_ADMIN_SECRET and a participant-purpose token with
// JWT_PARTICIPANT_SECRET — same secret separation participantAuth.js relies on.
export function issueRecoveryToken({ purpose, subjectId, invalidateWith, secret }) {
  return jwt.sign({ purpose, subjectId, invalidateWith }, secret, { expiresIn: "30m" });
}

export function verifyRecoveryToken(token, expectedPurpose, secret) {
  const payload = jwt.verify(token, secret);
  if (payload.purpose !== expectedPurpose) throw new Error("Wrong token purpose");
  return payload;
}
