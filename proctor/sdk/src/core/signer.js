// Defense-in-depth signing for the event stream. The server is still the sole
// authority on strikes and auto-submit — this only makes it harder to forge or
// replay a "nothing happened" event stream from outside the exam page.
//
// Key handoff: the backend generates a random per-attempt `signingKey` at
// `/start` and returns it to the page over the authenticated HTTPS response.
// It never touches localStorage. On the wire each batch carries an HMAC over
// the canonical JSON of its events.

/** @param {string} keyStr */
async function importKey(keyStr) {
  const raw = new TextEncoder().encode(keyStr);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/**
 * @param {string} signingKey
 * @returns {(payload: unknown) => Promise<string>} hex HMAC of JSON.stringify(payload)
 */
export function createSigner(signingKey) {
  if (!signingKey || !crypto?.subtle) {
    // No key or no WebCrypto (insecure context / very old browser): sign() is a
    // no-op. The server treats a missing/blank signature as "unverified" and can
    // be configured to reject or merely flag it.
    return async () => "";
  }
  const keyPromise = importKey(signingKey);
  return async function sign(payload) {
    const key = await keyPromise;
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const mac = await crypto.subtle.sign("HMAC", key, bytes);
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
}
