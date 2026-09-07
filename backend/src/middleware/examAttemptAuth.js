import jwt from "jsonwebtoken";
import crypto from "node:crypto";

// A per-attempt token, layered on top of requireParticipant. Binds the caller
// to one attempt id + participant id so a valid participant session can't be
// pointed at someone else's attempt. Lifetime tracks the exam clock (duration
// + a fixed grace window) so it naturally dies when the exam is over.

// NOT via requireEnvInt(): a grace window has a safe default, and env.js's
// fail-loud rule is reserved for values where a silent default is *dangerous*
// (a JWT secret, a token TTL that could mint a never-expiring token). This
// module is in the startup import graph — a missing var here must never
// crash-loop the whole backend (registration, payments, admin) for the sake
// of an additive feature.
const EXAM_ATTEMPT_GRACE_MS = Number(process.env.EXAM_ATTEMPT_GRACE_MS) || 600_000;

// Whether the exam feature can operate at all. The one hard requirement is a
// signing secret for the per-attempt token — without it the exam routes should
// return 503, not throw. See routes/exam.routes.js.
export function examFeatureConfigured() {
  return !!process.env.JWT_EXAM_SECRET;
}

export function attemptTokenTtlMs(durationMinutes) {
  return durationMinutes * 60 * 1000 + EXAM_ATTEMPT_GRACE_MS;
}

export function issueAttemptToken({ attemptId, participantId, examId }, ttlMs) {
  return jwt.sign({ attemptId, participantId, examId }, process.env.JWT_EXAM_SECRET, {
    expiresIn: Math.floor(ttlMs / 1000),
  });
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function attemptTokenCookieOptions(ttlMs) {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    partitioned: process.env.NODE_ENV === "production",
    maxAge: ttlMs,
    path: "/",
  };
}

export function setAttemptCookie(res, token, ttlMs) {
  res.cookie("examAttemptToken", token, attemptTokenCookieOptions(ttlMs));
}

// Chain AFTER requireParticipant. Verifies the attempt token (cookie or header)
// and checks it matches both the authenticated participant and the :id in the
// route.
export function requireExamAttempt(req, res, next) {
  const token = req.cookies?.examAttemptToken || req.headers["x-exam-attempt-token"];
  if (!token) return res.status(401).json({ error: "No exam attempt in progress" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_EXAM_SECRET);
  } catch {
    return res.status(401).json({ error: "Exam attempt token invalid or expired" });
  }

  if (req.participant && String(payload.participantId) !== String(req.participant.participantId)) {
    return res.status(403).json({ error: "Attempt does not belong to this account" });
  }
  if (req.params.id && String(payload.attemptId) !== String(req.params.id)) {
    return res.status(403).json({ error: "Attempt token does not match this attempt" });
  }

  req.examAttempt = payload;
  next();
}
