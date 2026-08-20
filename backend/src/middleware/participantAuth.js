import jwt from "jsonwebtoken";
import { issueRefreshToken } from "../services/refreshTokens.js";
import { requireEnvInt } from "../utils/env.js";

const PARTICIPANT_REFRESH_TTL_MS = requireEnvInt("PARTICIPANT_REFRESH_TTL_MS");
const PARTICIPANT_ACCESS_TTL_MS = requireEnvInt("PARTICIPANT_ACCESS_TTL_MS");

// Mirrors requireAdmin's dual cookie-or-header read exactly — cookie first
// (the normal browser path), header as a fallback for API testing tools.
export function requireParticipant(req, res, next) {
  const token = req.cookies?.participantToken || req.headers.authorization?.split(" ")[1];
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
    { expiresIn: Math.floor(PARTICIPANT_ACCESS_TTL_MS / 1000) }
  );
}

// sameSite must be "none" (+ secure) in production — see the matching note in
// adminAuth.js's adminRefreshCookieOptions().
export function participantRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    // Chrome/Edge block third-party cookies by default — see the matching
    // note in adminAuth.js's adminRefreshCookieOptions().
    partitioned: process.env.NODE_ENV === "production",
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

export function participantTokenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    partitioned: process.env.NODE_ENV === "production",
    maxAge: PARTICIPANT_ACCESS_TTL_MS,
    path: "/",
  };
}

export function setParticipantAccessCookie(res, token) {
  res.cookie("participantToken", token, participantTokenCookieOptions());
}

// Deliberately NOT httpOnly — see the matching note in adminAuth.js's
// setAdminSessionHint(). Never trusted server-side; requireParticipant only
// ever verifies the signed JWT (cookie or header).
export function participantSessionHintCookieOptions() {
  return {
    httpOnly: false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    partitioned: process.env.NODE_ENV === "production",
    maxAge: PARTICIPANT_REFRESH_TTL_MS,
    path: "/",
  };
}

export function setParticipantSessionHint(res, participant) {
  res.cookie(
    "participantSessionHint",
    JSON.stringify({ participantId: participant.id }),
    participantSessionHintCookieOptions()
  );
}

export async function issueParticipantSession(res, participant) {
  const accessToken = issueParticipantToken(participant);
  setParticipantAccessCookie(res, accessToken);
  await issueParticipantRefreshCookie(res, participant.id);
  setParticipantSessionHint(res, participant);
  return accessToken;
}

export { PARTICIPANT_REFRESH_TTL_MS, PARTICIPANT_ACCESS_TTL_MS };
