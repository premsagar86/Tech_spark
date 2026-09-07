import crypto from "node:crypto";

// Verifies the handshake "proof" the MV3 extension produced and the exam page
// forwarded to POST /start. The extension computes:
//
//   sig = HMAC_SHA256(PROCTOR_EXT_SHARED_SECRET, `${attemptId}|${origin}|${ts}|${v}`)
//
// We recompute it and also require the timestamp to be recent, so a captured
// proof can't be replayed later.
//
// Honest limitation: the shared secret ships inside a distributed extension and
// can be extracted. This check stops the casual "just don't install it" bypass
// and binds the proof to this attempt + origin + a short time window; it is not
// cryptographic proof of an untampered client. The real guarantees are layered:
// the page won't start without a handshake, this endpoint won't start without a
// valid proof, and every violation is on the admin timeline regardless.

const PROOF_TTL_MS = Number(process.env.PROCTOR_EXT_PROOF_TTL_MS) || 120000;

export function extensionRequired(exam) {
  return !!exam.require_extension;
}

/**
 * @param {{ attemptContext: string, origin: string, proof: any }} args
 *        attemptContext is whatever stable string the page also sent to the
 *        extension in HELLO (we use the exam slug + participant id).
 * @returns {{ ok: boolean, version: string|null, reason?: string }}
 */
export function verifyExtensionProof({ attemptContext, origin, proof }) {
  const secret = process.env.PROCTOR_EXT_SHARED_SECRET;
  if (!secret) return { ok: false, version: null, reason: "server_not_configured" };
  if (!proof || typeof proof !== "object") return { ok: false, version: null, reason: "missing" };

  const { v, ts, sig } = proof;
  if (!v || !ts || !sig) return { ok: false, version: null, reason: "malformed" };
  if (Math.abs(Date.now() - Number(ts)) > PROOF_TTL_MS) {
    return { ok: false, version: v, reason: "stale" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${attemptContext}|${origin}|${ts}|${v}`)
    .digest("hex");

  const a = Buffer.from(String(sig), "utf8");
  const b = Buffer.from(expected, "utf8");
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, version: v, reason: ok ? undefined : "mismatch" };
}
