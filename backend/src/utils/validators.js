const NAME_RE = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
const ROLL_NUMBER_RE = /^[A-Za-z0-9]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

export function isValidFullName(name) {
  const trimmed = (name ?? "").trim();
  return trimmed.length >= 3 && NAME_RE.test(trimmed);
}

export function isValidRollNumber(rollNumber) {
  return ROLL_NUMBER_RE.test((rollNumber ?? "").trim());
}

export function isValidEmail(email) {
  return EMAIL_RE.test((email ?? "").trim());
}

export function isValidMobile(mobile) {
  return MOBILE_RE.test((mobile ?? "").trim());
}

export function normalizeEmail(email) {
  return (email ?? "").trim().toLowerCase();
}

export function normalizeMobile(mobile) {
  return (mobile ?? "").trim();
}
