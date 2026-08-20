// Fails loudly at import time rather than falling back to a hardcoded
// default — for something like a token TTL, a silent NaN/undefined fallback
// would mean jwt.sign() mints a token that never expires, which is a much
// worse failure mode than the server refusing to boot.
export function requireEnvInt(name) {
  const raw = process.env[name];
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Missing or invalid required env var ${name} (expected a positive number, got ${JSON.stringify(raw)})`);
  }
  return value;
}
