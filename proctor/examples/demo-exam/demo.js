// Standalone demo wiring for the proctor SDK. No backend: we intercept the
// ingest POST and simulate the server's authoritative strike tally so the whole
// reconcile / auto-submit path can be exercised locally.

import { Proctor } from "../../sdk/src/index.js";

const INGEST_URL = "https://demo.local/ingest";
const STRIKE_LIMIT = 3;

// ---- mock server -----------------------------------------------------------
let serverStrikes = 0;
let serverAuto = false;
const STRIKE_KINDS = new Set(Object.entries(Proctor.DEFAULT_POLICY).filter(([, s]) => s === "strike").map(([k]) => k));

const realFetch = window.fetch.bind(window);
window.fetch = async (url, init) => {
  if (String(url) === INGEST_URL) {
    const body = JSON.parse(init.body);
    for (const ev of body.events) {
      if (STRIKE_KINDS.has(ev.kind) && !serverAuto) {
        serverStrikes += 1;
        if (serverStrikes >= STRIKE_LIMIT) serverAuto = true;
      }
      log(`↑ ${ev.kind}  [${ev.severity}]  seq=${ev.seq}  src=${ev.source}`);
    }
    return new Response(JSON.stringify({ strikes: serverStrikes, strikeLimit: STRIKE_LIMIT, autoSubmitted: serverAuto }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return realFetch(url, init);
};

// ---- UI ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function log(line) {
  const el = $("log");
  el.textContent += `${new Date().toLocaleTimeString()}  ${line}\n`;
  el.scrollTop = el.scrollHeight;
}

const proctor = Proctor.init({
  attemptId: "demo-attempt-1",
  ingestUrl: INGEST_URL,
  signingKey: "demo-signing-key",
  strikeLimit: STRIKE_LIMIT,
  requireExtension: false,
  camera: true,
  meta: { examSlug: "demo" },
});

$("limit").textContent = STRIKE_LIMIT;

proctor.on("event", (e) => {
  $("pending").textContent = proctor.getStatus().pendingEvents;
});
proctor.on("strike", ({ count, limit, kind, optimistic }) => {
  $("strikes").textContent = count;
  $("banner").textContent =
    count >= limit
      ? "Strike limit reached — the exam will be submitted."
      : `Warning ${count}/${limit}: "${kind}" detected. Stay on the exam, in fullscreen.`;
  $("banner").className = count >= limit ? "bad" : "warn";
  log(`  strike ${count}/${limit} (${optimistic ? "optimistic" : "server"}) via ${kind}`);
});
proctor.on("autosubmit", ({ reason }) => {
  $("autostate").textContent = "  → AUTO-SUBMITTED";
  $("autostate").className = "bad";
  log(`*** AUTO-SUBMIT (reason: ${reason}) ***`);
  teardown();
});
proctor.on("handshake", ({ ok, version }) => {
  $("ext").textContent = ok ? `connected (v${version})` : "not responding";
  $("ext").className = ok ? "ok" : "bad";
});

async function updateChrome() {
  const s = proctor.getStatus();
  $("fs").textContent = s.armed ? (proctor.isFullscreen() ? "yes" : "NO") : "no";
  $("fs").className = proctor.isFullscreen() ? "ok" : "bad";
}
setInterval(updateChrome, 1000);

function teardown() {
  proctor.disarm();
  $("submit").disabled = true;
  $("start").disabled = true;
  $("cam").textContent = "off";
}

// ---- controls ----------------------------------------------------------
$("start").addEventListener("click", async () => {
  const hs = await proctor.handshake();
  $("ext").textContent = hs.installed ? (hs.connected ? `connected (v${hs.version})` : "installed, no response") : "not installed";
  $("ext").className = hs.connected ? "ok" : hs.installed ? "warn" : "bad";
  await proctor.arm({ fullscreenTarget: document.documentElement });
  $("cam").textContent = "on (face count only)";
  $("start").disabled = true;
  $("submit").disabled = false;
  log("armed");
});

$("submit").addEventListener("click", () => {
  log("manual submit");
  teardown();
});

document.querySelectorAll("[data-sim]").forEach((b) =>
  b.addEventListener("click", () => proctor._simulate(b.dataset.sim, { simulated: true }))
);

log("SDK loaded. Click “Start exam”.");
