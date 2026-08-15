import rateLimit from "express-rate-limit";

export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many registration attempts, try again later." },
});

// Shared shape for admin login and participant login (Part 9) — both are
// mobile/password-guessing risks against a known email/username.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, try again later." },
});

// Recovery endpoints (Part 9) — without a limit, either could be used to
// mail-bomb an inbox by repeatedly requesting links for the same address.
export const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many requests, try again later." },
});
