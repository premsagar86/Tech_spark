import jwt from "jsonwebtoken";

export function requireParticipant(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.participant = jwt.verify(token, process.env.JWT_PARTICIPANT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Distinct secret from adminAuth.js so an admin token can never double as a
// participant token or vice versa.
export function issueParticipantToken(participant) {
  return jwt.sign(
    { participantId: participant.id, registrationId: participant.registration_id },
    process.env.JWT_PARTICIPANT_SECRET,
    { expiresIn: "60d" }
  );
}
