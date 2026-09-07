// Build-time configuration for the extension.
//
// CHANGE BOTH VALUES BEFORE PACKAGING FOR A REAL DEPLOYMENT.
//
// SHARED_SECRET
//   Used to sign the handshake "proof" the page forwards to POST /start. The
//   backend recomputes the same HMAC (env PROCTOR_EXT_SHARED_SECRET) and rejects
//   the attempt if it doesn't match or is stale.
//
//   Honest limitation: a secret shipped inside a distributed extension can be
//   extracted by a determined candidate. This check raises the bar (a casual
//   "just don't install it" bypass fails) but is not cryptographic proof of an
//   untampered extension. The real integrity guarantee is the layered design:
//   page refuses to start without the handshake, backend refuses without a valid
//   proof, and every violation is on the admin timeline regardless. For higher
//   assurance, move proof generation to a server the extension calls with its
//   Web Store identity.
//
// ALLOWED_ORIGINS
//   Origins the proctor will operate on. Must line up with `host_permissions`
//   and `content_scripts.matches` in manifest.json.

export const CONFIG = {
  VERSION: "0.1.0",
  SHARED_SECRET: "CHANGE_ME_dev_only_shared_secret",
  ALLOWED_ORIGINS: [
    "http://localhost",
    "http://127.0.0.1",
    "https://app.techspark.example",
  ],
  // Proof timestamp tolerance the backend should also enforce.
  PROOF_TTL_MS: 120000,
};
