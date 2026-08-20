const NAME_RE = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
const ROLL_NUMBER_RE = /^[A-Za-z0-9]+$/;

export function isValidFullName(name) {
  const trimmed = (name ?? "").trim();
  return trimmed.length >= 3 && NAME_RE.test(trimmed);
}

export function isValidRollNumber(rollNumber) {
  return ROLL_NUMBER_RE.test((rollNumber ?? "").trim());
}
