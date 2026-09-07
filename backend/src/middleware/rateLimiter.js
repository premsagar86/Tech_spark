import rateLimit from "express-rate-limit";
import { requireEnvInt } from "../utils/env.js";

export const registrationLimiter = rateLimit({
  windowMs: requireEnvInt("REGISTRATION_RATE_LIMIT_WINDOW_MS"),
  max: 20,
  message: { error: "Too many registration attempts, try again later." },
});

// Shared shape for admin login and participant login (Part 9) — both are
// mobile/password-guessing risks against a known email/username.
export const loginLimiter = rateLimit({
  windowMs: requireEnvInt("LOGIN_RATE_LIMIT_WINDOW_MS"),
  max: 10,
  message: { error: "Too many login attempts, try again later." },
});

// Recovery endpoints (Part 9) — without a limit, either could be used to
// mail-bomb an inbox by repeatedly requesting links for the same address.
export const recoveryLimiter = rateLimit({
  windowMs: requireEnvInt("RECOVERY_RATE_LIMIT_WINDOW_MS"),
  max: 5,
  message: { error: "Too many requests, try again later." },
});

// Exam endpoints. Windows are fixed constants (not env-tunable like the ones
// above) — the acceptable rate for "start an exam" and "report proctor events"
// isn't something an operator needs to tune per environment.
//
// Starting an attempt is close to a one-shot per candidate; a handful of retries
// covers a flaky first request.
export const examStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: "Too many exam-start attempts, wait a few minutes." },
});

// The proctor SDK batches events (~1 request / 4s, plus an immediate flush on a
// strike). This ceiling only trips on a client that's misbehaving or replaying.
export const examEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Proctor event rate exceeded." },
});
