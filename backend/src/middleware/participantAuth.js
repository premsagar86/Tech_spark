import jwt from "jsonwebtoken";
import { issueRefreshToken } from "../services/refreshTokens.js";

const PARTICIPANT_REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

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
// participant token or vice versa. Short-lived on purpose — see
// issueParticipantSession() below, which pairs it with a long-lived,
// revocable refresh token (this replaces the old flat 60-day expiry).
export function issueParticipantToken(participant) {
  return jwt.sign(
    { participantId: participant.id, registrationId: participant.registration_id },
    process.env.JWT_PARTICIPANT_SECRET,
    { expiresIn: "30m" }
  );
}

// sameSite must be "none" (+ secure) in production — see the matching note in
// adminAuth.js's adminRefreshCookieOptions().
export function participantRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PARTICIPANT_REFRESH_TTL_MS,
    path: "/",
  };
}

// Just the refresh half — for registration/payment auto-login, which already
// mints its own access token via confirmPayment() and shouldn't mint a second,
// different one for the same login event.
export async function issueParticipantRefreshCookie(res, participantId) {
  const { token } = await issueRefreshToken("participant", participantId, PARTICIPANT_REFRESH_TTL_MS);
  res.cookie("participantRefreshToken", token, participantRefreshCookieOptions());
}

export async function issueParticipantSession(res, participant) {
  const accessToken = issueParticipantToken(participant);
  await issueParticipantRefreshCookie(res, participant.id);
  return accessToken;
}

export { PARTICIPANT_REFRESH_TTL_MS };
