# Exam Proctoring Monitor — complete guide

Anti-cheat monitoring for online tests. When a candidate opens the exam page the
test starts; if they try to cheat, warnings escalate and the attempt is
**auto-submitted** at a configurable strike limit. Every signal lands on an
admin timeline.

This document covers the whole system: architecture, every file with code
snippets, the client↔extension↔server contract, how it's wired into the
TechSpark site, and how to drop it into **any** site.

---

## Contents

1. [Design in one picture](#1-design-in-one-picture)
2. [Why an SDK *and* an extension](#2-why-an-sdk-and-an-extension)
3. [Repository layout](#3-repository-layout)
4. [Part A — the in-page SDK](#4-part-a--the-in-page-sdk)
5. [Part B — the MV3 browser extension](#5-part-b--the-mv3-browser-extension)
6. [Part C — the backend contract](#6-part-c--the-backend-contract)
7. [Part D — the exam UI (frontend)](#7-part-d--the-exam-ui-frontend)
8. [Signals reference](#8-signals-reference)
9. [Install & run on the TechSpark site](#9-install--run-on-the-techspark-site)
10. [Reuse it on any site](#10-reuse-it-on-any-site)
11. [Real webcam face-counting](#11-real-webcam-face-counting)
12. [Privacy, retention, limitations](#12-privacy-retention-limitations)
13. [Verification checklist](#13-verification-checklist)

---

## 1. Design in one picture

```
        exam page (any framework)                     MV3 extension (Chrome/Edge)
   ┌────────────────────────────┐            ┌──────────────────────────────────┐
   │  @techspark/proctor-sdk    │            │ inject-main.js   (MAIN world)     │ window.__PROCTOR_EXT__
   │   monitors/*  ── report() ─┼──┐         │ content-script.js (isolated)     │ <─ window.postMessage ─>
   │   core/strike-engine       │  │         │ background.js (service worker)    │ chrome.tabs / windows /
   │   core/event-queue  ───────┼──┼── POST ─▶│                                  │ webNavigation / system.display
   │   bridge/extension-bridge  │◀─┼─────────▶└──────────────────────────────────┘
   └───────────┬────────────────┘  │
               │                   └── handshake: HELLO {context} → READY {version, proof, capabilities}
               │
               │  POST /api/exam/attempts/:id/events   (batched, HMAC-signed)
               ▼
        your backend
          services/strikePolicy.js   — kind → severity, recount strikes from the log
          → status = 'auto_submitted' when strikes >= strike_limit
          response: { strikes, strikeLimit, autoSubmitted }   ← authoritative
```

**Golden rule:** the client is a *sensor*, never a *judge*. The page shows
optimistic "Warning 2/3" for responsiveness, but the server recounts strikes from
the stored `exam_events` rows on every request and owns the auto-submit decision.

---

## 2. Why an SDK *and* an extension

| Capability | In-page SDK alone | + MV3 extension |
| --- | --- | --- |
| Tab hidden / minimised | `visibilitychange`, `blur` (fires, but no detail) | exact target tab id |
| Switched to another tab | ✗ (page is backgrounded, learns nothing) | `chrome.tabs.onActivated` |
| Opened a new tab | ✗ | `chrome.tabs.onCreated` |
| Focus left the browser window | heuristic only | `chrome.windows.onFocusChanged` (real) |
| Second monitor connected | `screen.isExtended` (boolean, Chromium only) | `chrome.system.display.getInfo()` (authoritative) |
| Navigating away from the exam URL | `beforeunload` (after the fact) | `webNavigation.onBeforeNavigate` (can cancel) |
| Fullscreen exit, clipboard, right-click, dev-tools keys, camera | ✓ | ✓ (same SDK) |

The SDK works **without** the extension in a degraded mode. When an exam is
high-stakes you set `require_extension: true` and the page refuses to start
without a verified handshake.

---

## 3. Repository layout

```
proctor/                              ← self-contained, publishable, framework-agnostic
├── package.json                      (workspace root)
├── README.md                         (short version of this doc)
├── sdk/
│   ├── package.json                  name: @techspark/proctor-sdk, type: module, main: src/index.js
│   └── src/
│       ├── index.js                  Proctor.init() — the public API
│       ├── core/
│       │   ├── emitter.js            tiny event emitter
│       │   ├── signer.js             per-attempt HMAC over each event batch
│       │   ├── event-queue.js        batch + retry + sendBeacon
│       │   └── strike-engine.js      DEFAULT_POLICY (kind→severity), local mirror
│       ├── bridge/
│       │   └── extension-bridge.js   postMessage handshake + event relay
│       └── monitors/
│           ├── visibility.js         tab_blur / visibility_hidden
│           ├── fullscreen.js         fullscreen_exit + request()
│           ├── clipboard.js          copy / cut / paste / paste_large
│           ├── contextmenu.js        contextmenu
│           ├── keyboard.js           blocked_shortcut (F12, Ctrl+T/N/W/S/U/P, …)
│           ├── devtools.js           devtools (heuristic, warn-only)
│           ├── display.js            multi_display
│           ├── camera-face.js        no_face / multi_face (count only, no images)
│           └── pagelife.js           page_hidden (beforeunload / pagehide)
├── extension/                        ← MV3, no build step
│   ├── manifest.json
│   ├── config.js                     SHARED_SECRET + ALLOWED_ORIGINS  ← edit before packaging
│   ├── inject-main.js                sets window.__PROCTOR_EXT__ synchronously
│   ├── content-script.js             page ⇄ service-worker relay
│   ├── background.js                 tab/window/display watchers + handshake proof
│   ├── popup.html / popup.js
│   └── options.html / options.js
└── examples/
    └── demo-exam/                    ← develop the monitor with no backend
        ├── index.html
        └── demo.js                   mocks the ingest endpoint

techspark integration:
  backend/src/routes/exam.routes.js            /api/exam/*
  backend/src/controllers/exam.controller.js
  backend/src/models/exams.model.js
  backend/src/services/strikePolicy.js         SEVERITY_BY_KIND (mirror of SDK DEFAULT_POLICY)
  backend/src/services/gradeAttempt.js
  backend/src/services/extensionProof.js       verify the handshake proof
  backend/src/middleware/examAttemptAuth.js    per-attempt JWT
  backend/src/db/schema.sql + migrate.js       exams, exam_questions, exam_attempts, exam_answers, exam_events
  backend/src/db/seedExam.js                   npm run db:seed:exam
  frontend/src/pages/Exam.jsx                  state machine
  frontend/src/exam/*                           gate / consent / shell / question / submitted
  frontend/src/proctor/proctorClient.js        wraps the SDK
  frontend/src/admin/AdminExamAttempts.jsx     review timeline + manual score
  frontend/vite.config.js                       alias @techspark/proctor-sdk → ../proctor/sdk/src
```

---

## 4. Part A — the in-page SDK

### 4.1 Public API (`sdk/src/index.js`)

```js
import { Proctor } from "@techspark/proctor-sdk";

const p = Proctor.init({
  handshakeContext: "sample",   // a string the page knows BEFORE an attempt exists (the exam slug)
  strikeLimit: 3,
  requireExtension: true,
  camera: true,                 // or { detector: fn, sampleMs, noFaceGraceMs }
  policy: {},                   // override kind→severity, e.g. { devtools: "info" }
  monitors: {                   // per-monitor options
    clipboard: { block: true, largePasteChars: 120 },
    keyboard: { block: true },
    contextmenu: { block: true },
  },
  meta: { examSlug: "sample" }, // attached to every ingest batch
});

// 1. detect + verify the extension
const hs = await p.handshake();
//    hs = { installed, connected, version, proof, capabilities, requiredButMissing }

// 2. send hs.proof to POST /start, then feed the response back in
p.configure({ attemptId, signingKey, ingestUrl });

// 3. arm — MUST be inside a user gesture (requestFullscreen + getUserMedia need one)
await p.arm({ fullscreenTarget: document.documentElement });

// 4. react
p.on("event",       (e) => {/* {kind, severity, detail, source, seq, clientTs} */});
p.on("strike",      ({ count, limit, kind, optimistic }) => showBanner(count, limit));
p.on("autosubmit",  ({ reason }) => submitExam());
p.on("handshake",   ({ ok, version, proof, capabilities }) => {});

// 5. teardown on submit
p.disarm();

// helpers
p.hasExtension();       // sync boolean
p.isFullscreen();
p.requestFullscreen(el);
p.getStatus();          // { armed, strikes, limit, autoSubmitted, pendingEvents, extension }
```

### 4.2 The one funnel every monitor reports through

```js
// sdk/src/index.js
function report(kind, detail = {}, source = "sdk") {
  const severity = strikes.severityOf(kind);
  strikes.record(kind);                              // optimistic; server reconciles
  const record = { kind, severity, detail, source, clientTs: Date.now() };
  const stored = queue.enqueue(record);
  emit("event", stored || record);
}
```

Extension events flow into the same funnel:

```js
bridge.onEvent(({ kind, detail, source }) => report(kind, detail, source || "extension"));
```

### 4.3 Severity map (`sdk/src/core/strike-engine.js`)

Keep this **in sync** with the backend's `services/strikePolicy.js`.

```js
export const DEFAULT_POLICY = {
  // hard "left the exam" — a strike each
  tab_blur: "strike", tab_switch: "strike", new_tab_opened: "strike",
  window_blur: "strike", visibility_hidden: "strike", fullscreen_exit: "strike",
  nav_attempt: "strike", multi_display: "strike", paste_large: "strike",
  multi_face: "strike", extension_lost: "strike", camera_lost: "strike",
  // softer — logged + shown, not an automatic strike
  copy: "warn", cut: "warn", paste: "warn", contextmenu: "warn",
  blocked_shortcut: "warn", devtools: "warn", no_face: "warn", risky_extension: "warn",
  // informational
  page_hidden: "info", extension_missing: "info", camera_denied: "info",
  handshake_ok: "info", queue_overflow: "info",
};
```

The server's reply reconciles the local tally:

```js
function reconcile({ strikes: serverStrikes, strikeLimit: serverLimit, autoSubmitted: serverAuto }) {
  if (typeof serverLimit  === "number") strikeLimit = serverLimit;
  if (typeof serverStrikes === "number" && serverStrikes !== strikes) {
    strikes = serverStrikes;
    emit("strike", { count: strikes, limit: strikeLimit, kind: "server", optimistic: false });
  }
  if (serverAuto && !autoSubmitted) { autoSubmitted = true; emit("autosubmit", { reason: "server", strikes }); }
}
```

### 4.4 Event queue (`sdk/src/core/event-queue.js`)

- Flush on a 4 s timer **or immediately** when a `strike`-severity event lands.
- Retry failed flushes with capped exponential backoff; nothing dropped except by
  a hard 500-event buffer cap (which itself emits `queue_overflow`).
- `navigator.sendBeacon` on page hide/unload so a closing tab still delivers.
- Every batch carries a monotonic `seq` per event + an HMAC of the batch.

```js
async function postBatch(events, { beacon = false } = {}) {
  const { ingestUrl, attemptId } = getConfig();
  const body = { attemptId, sentAt: Date.now(), events, meta: getAuthMeta?.() ?? {} };
  body.sig = await getSign()(body.events);

  if (beacon && navigator.sendBeacon) {
    return navigator.sendBeacon(ingestUrl, new Blob([JSON.stringify(body)], { type: "application/json" }));
  }
  const res = await fetch(ingestUrl, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), keepalive: beacon,
  });
  if (!res.ok) throw new Error(`ingest ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (data && typeof data.strikes === "number") onServerState?.(data);   // reconcile
  return data;
}
```

### 4.5 Batch signing (`sdk/src/core/signer.js`)

Defense-in-depth — the server is still authoritative, this just makes it harder
to forge a "nothing happened" stream.

```js
export function createSigner(signingKey) {
  if (!signingKey || !crypto?.subtle) return async () => "";
  const keyPromise = crypto.subtle.importKey(
    "raw", new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return async function sign(payload) {
    const key = await keyPromise;
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(payload)));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
}
```

### 4.6 Example monitor (`sdk/src/monitors/visibility.js`)

Every monitor is a factory returning `{ start(), stop() }` and calls
`report(kind, detail)`.

```js
export function createVisibilityMonitor({ report, opts = {} }) {
  const cooldownMs = opts.cooldownMs ?? 1200;
  let last = 0, pollId = null, hadFocus = true;

  const fire = (kind, detail) => {
    const now = Date.now();
    if (now - last < cooldownMs) return;   // one alt-tab ≠ three strikes
    last = now; report(kind, detail);
  };
  const onVisibility = () => { if (document.visibilityState === "hidden") fire("visibility_hidden", { via: "visibilitychange" }); };
  const onBlur = () => fire("tab_blur", { via: "window.blur" });
  const onFocus = () => { hadFocus = true; };

  return {
    start() {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("blur", onBlur);
      window.addEventListener("focus", onFocus);
      pollId = setInterval(() => {
        const focused = document.hasFocus();
        if (hadFocus && !focused) fire("tab_blur", { via: "hasFocus" });
        hadFocus = focused;
      }, opts.pollMs ?? 1000);
    },
    stop() {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (pollId) clearInterval(pollId);
    },
  };
}
```

Fullscreen is special — it also exposes `request()` (call it from the "Start"
gesture) and reports `fullscreen_exit` on `fullscreenchange` while armed:

```js
// sdk/src/monitors/fullscreen.js
async request(el) {
  const t = el || opts.element || document.documentElement;
  if (t.requestFullscreen) return t.requestFullscreen();
  if (t.webkitRequestFullscreen) return t.webkitRequestFullscreen();
  throw new Error("Fullscreen API unavailable");
}
```

Clipboard escalates a big paste to a strike:

```js
// sdk/src/monitors/clipboard.js
const onPaste = (e) => {
  let text = "";
  try { text = (e.clipboardData || window.clipboardData)?.getData("text") ?? ""; } catch {}
  report(text.length >= largePasteChars ? "paste_large" : "paste", { length: text.length });
  if (block) e.preventDefault();
};
```

### 4.7 Camera face-presence (`sdk/src/monitors/camera-face.js`)

**No frame ever leaves the page** — it samples into a tiny canvas, asks a
detector "how many faces?", and emits only an integer + timestamp.

```js
async function countFaces() {
  if (userDetector) {                         // plug MediaPipe / face-api.js here
    const r = await userDetector(video).catch(() => null);
    return r && typeof r.faces === "number" ? r.faces : null;
  }
  if (nativeDetector) {                        // window.FaceDetector where available
    const faces = await nativeDetector.detect(video).catch(() => null);
    return Array.isArray(faces) ? faces.length : null;
  }
  // fallback: mean luminance — only detects a covered/black lens => no_face
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0; for (let i = 0; i < data.length; i += 4) sum += (data[i]+data[i+1]+data[i+2]) / 3;
  return sum / (data.length / 4) < 12 ? 0 : null;   // null = "can't tell, assume ok"
}
```

---

## 5. Part B — the MV3 browser extension

No build step — plain MV3. Load `proctor/extension/` unpacked.

### 5.1 `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "TechSpark Exam Proctor",
  "version": "0.1.0",
  "minimum_chrome_version": "116",
  "permissions": ["tabs", "webNavigation", "system.display", "storage"],
  "optional_permissions": ["management"],
  "host_permissions": ["http://localhost/*", "http://127.0.0.1/*", "https://*.techspark.example/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    { "matches": ["http://localhost/*", "https://*.techspark.example/*"], "js": ["content-script.js"], "run_at": "document_start" },
    { "matches": ["http://localhost/*", "https://*.techspark.example/*"], "js": ["inject-main.js"], "run_at": "document_start", "world": "MAIN" }
  ],
  "action": { "default_popup": "popup.html", "default_title": "TechSpark Exam Proctor" },
  "options_page": "options.html"
}
```

### 5.2 Presence beacon (`inject-main.js`, MAIN world, `document_start`)

```js
Object.defineProperty(window, "__PROCTOR_EXT__", {
  value: Object.freeze({ version: "0.1.0", vendor: "techspark" }),
  writable: false, configurable: false, enumerable: false,
});
```

The SDK reads this synchronously to decide whether to show the install gate:

```js
// sdk/src/bridge/extension-bridge.js
export function detectExtensionSync() {
  const shim = typeof window !== "undefined" && window.__PROCTOR_EXT__;
  return shim && typeof shim.version === "string"
    ? { installed: true, version: shim.version } : { installed: false };
}
```

### 5.3 Relay (`content-script.js`, isolated world)

```js
const NS = "techspark-proctor";
let port = chrome.runtime.connect({ name: "proctor" });
port.onMessage.addListener((msg) => window.postMessage({ source: NS, dir: "ext", ...msg }, location.origin));

window.addEventListener("message", (ev) => {
  if (ev.source !== window) return;
  const m = ev.data;
  if (!m || m.source !== NS || m.dir !== "page") return;
  port.postMessage({ type: m.type, context: m.context, origin: m.origin || location.origin });
});
```

### 5.4 Handshake proof + watchers (`background.js`, service worker)

```js
import { CONFIG } from "./config.js";

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeProof(context, origin) {                     // context = exam slug
  const ts = Date.now();
  const sig = await hmacHex(CONFIG.SHARED_SECRET, `${context}|${origin}|${ts}|${CONFIG.VERSION}`);
  return { v: CONFIG.VERSION, ts, sig };
}

// fan global browser events out to every armed exam tab
chrome.tabs.onActivated.addListener((info) => {
  for (const [tabId, e] of examTabs) if (e.armed && info.tabId !== tabId) send(tabId, "tab_switch", { toTabId: info.tabId });
});
chrome.windows.onFocusChanged.addListener((wid) => {
  for (const [tabId, e] of examTabs)
    if (e.armed && (wid === chrome.windows.WINDOW_ID_NONE || wid !== e.windowId)) send(tabId, "window_blur", { focusedWindow: wid });
});
chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId !== 0) return;
  const e = examTabs.get(d.tabId);
  if (e?.armed && new URL(d.url).origin !== e.origin) send(d.tabId, "nav_attempt", { url: d.url });
});
// chrome.tabs.onCreated → new_tab_opened ; chrome.system.display → multi_display
```

### 5.5 `config.js` — the only thing you edit before packaging

```js
export const CONFIG = {
  VERSION: "0.1.0",
  SHARED_SECRET: "CHANGE_ME_dev_only_shared_secret",   // must equal backend PROCTOR_EXT_SHARED_SECRET
  ALLOWED_ORIGINS: ["http://localhost", "https://app.techspark.example"],
  PROOF_TTL_MS: 120000,
};
```

> **Honest limitation.** A secret shipped inside a distributed extension can be
> extracted. This stops the casual "just don't install it" bypass and binds the
> proof to `slug + origin + a 2-minute window`; it is not cryptographic proof of
> an untampered client. The real guarantee is layered: page won't start without
> the handshake, backend won't create an attempt without a valid proof, and every
> violation is on the timeline regardless.

### 5.6 Package / publish

```bash
cd proctor/extension
zip -r ../proctor-extension.zip . -x '*.DS_Store'
# Chrome Web Store → new item → upload → set visibility "Unlisted" → note the extension ID
# Edge Add-ons accepts the same zip unchanged
```

---

## 6. Part C — the backend contract

Any backend that implements **two endpoints** works. Reference implementation:
`backend/src/`.

### 6.1 Tables (`backend/src/db/schema.sql`, also in `migrate.js`)

```sql
CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(60) UNIQUE, title VARCHAR(150),
  event_id INT NULL, duration_minutes INT DEFAULT 60, strike_limit INT DEFAULT 3,
  require_extension BOOLEAN DEFAULT TRUE, require_camera BOOLEAN DEFAULT TRUE,
  shuffle_questions BOOLEAN DEFAULT FALSE, reveal_score BOOLEAN DEFAULT FALSE,
  opens_at DATETIME NULL, closes_at DATETIME NULL
);
CREATE TABLE exam_questions (
  id INT AUTO_INCREMENT PRIMARY KEY, exam_id INT,
  type ENUM('mcq','short','coding') DEFAULT 'mcq', prompt TEXT,
  options JSON NULL, correct_answer JSON NULL,          -- NEVER sent to a live attempt
  language VARCHAR(30) NULL, starter_code TEXT NULL, points INT DEFAULT 1, order_index INT
);
CREATE TABLE exam_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY, exam_id INT, participant_id INT,
  attempt_token_hash CHAR(64) NULL, signing_key CHAR(64) NULL,
  status ENUM('in_progress','submitted','auto_submitted','expired') DEFAULT 'in_progress',
  strikes INT DEFAULT 0, auto_score DECIMAL(10,2) NULL, score DECIMAL(10,2) NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, submitted_at TIMESTAMP NULL,
  expires_at DATETIME NOT NULL, ip VARCHAR(45), user_agent TEXT, extension_version VARCHAR(20),
  UNIQUE KEY uniq_exam_participant (exam_id, participant_id)     -- one attempt each
);
CREATE TABLE exam_answers (
  id INT AUTO_INCREMENT PRIMARY KEY, attempt_id INT, question_id INT, answer JSON NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_attempt_question (attempt_id, question_id)
);
CREATE TABLE exam_events (                              -- the proctor audit log, no images
  id INT AUTO_INCREMENT PRIMARY KEY, attempt_id INT, kind VARCHAR(40),
  severity ENUM('info','warn','strike') DEFAULT 'info',
  source ENUM('sdk','extension','server') DEFAULT 'sdk',
  detail JSON NULL, seq INT NULL, client_ts BIGINT NULL, server_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **Timezone gotcha (learned the hard way):** don't round-trip `expires_at`
> through a JS `Date` — mysql2 reads a `DATETIME` back in the connection
> timezone and silently shifts it, so every attempt reads as already expired.
> Do the math in SQL:
> ```sql
> -- write
> INSERT ... expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
> -- read
> SELECT *, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS remaining_seconds,
>           (NOW() >= expires_at) AS is_expired FROM exam_attempts WHERE id = ?
> ```

### 6.2 Endpoint 1 — `POST /api/exam/:slug/start`

Auth: participant session. Body: `{ extProof: { v, ts, sig } }`.

```js
// backend/src/controllers/exam.controller.js  (startAttempt, condensed)
const exam = await getExamBySlug(req.params.slug);
if (windowState(exam) !== "open") throw httpError(403, "exam not open");

if (exam.require_extension) {
  const r = verifyExtensionProof({ attemptContext: exam.slug, origin: req.headers.origin, proof: req.body.extProof });
  if (!r.ok) return res.status(403).json({ error: "proctor extension could not be verified", reason: r.reason });
}

let attempt = await getAttemptForParticipant(exam.id, participantId);
if (attempt) {
  if (attempt.status === "in_progress" && Number(attempt.remaining_seconds) > 0) {
    /* resume: reissue token, return same attempt + questions */
  }
  return res.status(409).json({ error: "You have already used your attempt at this exam." });
}

const signingKey = crypto.randomBytes(32).toString("hex");
attempt = await createAttempt({ examId: exam.id, participantId, signingKey, durationMinutes: exam.duration_minutes, ip: req.ip, userAgent: req.get("user-agent") });
const token = issueAttemptToken({ attemptId: attempt.id, participantId, examId: exam.id }, ttlMs);
setAttemptCookie(res, token, ttlMs);

res.json({
  attemptId: attempt.id,
  signingKey,
  ingestPath: `/api/exam/attempts/${attempt.id}/events`,
  strikeLimit: exam.strike_limit,
  remainingMs: Number(attempt.remaining_seconds) * 1000,
  questions: questions.map(publicQuestion),   // options + `multi` flag, NO correct_answer
});
```

Proof verification (`backend/src/services/extensionProof.js`):

```js
export function verifyExtensionProof({ attemptContext, origin, proof }) {
  const secret = process.env.PROCTOR_EXT_SHARED_SECRET;
  if (!secret || !proof?.sig || !proof?.ts || !proof?.v) return { ok: false, reason: "missing" };
  if (Math.abs(Date.now() - Number(proof.ts)) > PROOF_TTL_MS) return { ok: false, reason: "stale" };
  const expected = crypto.createHmac("sha256", secret)
    .update(`${attemptContext}|${origin}|${proof.ts}|${proof.v}`).digest("hex");
  const a = Buffer.from(String(proof.sig)), b = Buffer.from(expected);
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b), version: proof.v };
}
```

### 6.3 Endpoint 2 — `POST /api/exam/attempts/:id/events`

Auth: participant session **+** per-attempt token. Body:
`{ attemptId, events: [{ kind, source, detail, seq, clientTs }], sig }`.

```js
// backend/src/services/strikePolicy.js  (ingestAndScore, condensed)
await insertEvents(attempt.id, events.map((e) => ({ ...e, severity: severityOf(e.kind) })));

// recount from the log — a replayed/duplicated batch can't inflate the tally
const [[{ strikes }]] = await pool.query(
  "SELECT COUNT(*) AS strikes FROM exam_events WHERE attempt_id = ? AND severity = 'strike'", [attempt.id]);

const strikeLimit = exam.strike_limit ?? 3;
let status = attempt.status, autoSubmitted = false;
if (status === "in_progress") {
  if (strikes >= strikeLimit)            { status = "auto_submitted"; autoSubmitted = true; }
  else if (Number(attempt.remaining_seconds) <= 0) status = "expired";
  await pool.query("UPDATE exam_attempts SET status=?, strikes=?, submitted_at=COALESCE(submitted_at, IF(?<>'in_progress', NOW(), NULL)) WHERE id=?",
    [status, strikes, status, attempt.id]);
}
return { strikes, strikeLimit, autoSubmitted, ended: status !== "in_progress", status };
```

`severityOf` uses `SEVERITY_BY_KIND` — the **same map** as the SDK's
`DEFAULT_POLICY` (§4.3). If they drift, the client warns for something the server
ignores (or vice-versa).

### 6.4 Supporting endpoints (reference impl only, not required for reuse)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/exam/:slug` | meta only (duration, question count, flags). No questions. |
| `GET`  | `/api/exam/attempts/:id` | resume: status, `remainingMs`, saved answers, strikes |
| `POST` | `/api/exam/attempts/:id/answers` | batch autosave `{ answers: [{questionId, answer}] }`; `409` once not in progress |
| `POST` | `/api/exam/attempts/:id/submit` | finalize + auto-grade (mcq/short); coding left for manual `score` |
| `GET`  | `/api/admin/exam/:slug/attempts` | admin: list with strikes/status/score |
| `GET`  | `/api/admin/exam/attempts/:id` | admin: full `exam_events` timeline + answers + correct answers |
| `PATCH`| `/api/admin/exam/attempts/:id/score` | admin: manual coding score |

### 6.5 Auto-grading (`backend/src/services/gradeAttempt.js`)

```js
function isCorrect(q, answer) {
  if (answer == null || q.correct_answer == null) return false;
  if (q.type === "mcq") {
    if (Array.isArray(q.correct_answer) || Array.isArray(answer))       // multi-select, order-independent
      return sameSet(asArray(answer), asArray(q.correct_answer));
    return norm(answer) === norm(q.correct_answer);
  }
  if (q.type === "short")                                               // case-insensitive, trimmed
    return asArray(q.correct_answer).some((c) => norm(c) === norm(answer));
  return false;                                                         // coding → manual
}
```

### 6.6 New env vars (fail-loud at boot — see `backend/.env.example`)

```
JWT_EXAM_SECRET=<random>
EXAM_ATTEMPT_GRACE_MS=600000                 # added to duration for the attempt-token TTL
PROCTOR_EXT_SHARED_SECRET=<random>           # MUST equal proctor/extension/config.js SHARED_SECRET
PROCTOR_EXT_PROOF_TTL_MS=120000              # optional, default 120000
```

---

## 7. Part D — the exam UI (frontend)

### 7.1 Route (chromeless — no navbar/footer during a test)

```jsx
// frontend/src/App.jsx
<Route path="/exam/:slug" element={<ParticipantRoute><Exam /></ParticipantRoute>} />
<Route path="/admin/exam/:slug" element={<AdminRoute roles={["admin"]}><AdminExamAttempts /></AdminRoute>} />
```

### 7.2 SDK wrapper (`frontend/src/proctor/proctorClient.js`)

```js
import { Proctor } from "@techspark/proctor-sdk";   // aliased in vite.config.js → ../proctor/sdk/src
const API_BASE = import.meta.env.VITE_API_URL || "";

export function createProctor({ examSlug, strikeLimit, requireExtension, requireCamera }) {
  const p = Proctor.init({
    handshakeContext: examSlug, strikeLimit, requireExtension,
    camera: requireCamera ? { detector: null } : false,      // plug a real detector here
    monitors: { clipboard: { block: true, largePasteChars: 120 }, keyboard: { block: true }, contextmenu: { block: true } },
  });
  return {
    handshake: () => p.handshake(),
    configure: ({ attemptId, signingKey, ingestPath }) =>
      p.configure({ attemptId, signingKey, ingestUrl: `${API_BASE}${ingestPath}` }),
    arm: (o) => p.arm(o), disarm: () => p.disarm(),
    isFullscreen: () => p.isFullscreen(), requestFullscreen: (el) => p.requestFullscreen(el),
    on: (ev, cb) => p.on(ev, cb),
  };
}
```

### 7.3 Orchestrator state machine (`frontend/src/pages/Exam.jsx`)

```
loading → error | closed | done
        → gate (extension handshake) → consent (camera disclosure) → ready (Start button)
        → running (timer + strike banner + autosave + fullscreen overlay)
        → submitting → done
```

The start handler — the important bit is the ordering inside the user gesture:

```jsx
async function startExam() {
  const data = await api.startExam(slug, { extProof: handshake?.proof || null });
  attemptIdRef.current = data.attemptId;
  proctorRef.current.configure(data);                       // attemptId + signingKey + ingestPath
  setQuestions(data.questions);
  setDeadline(Date.now() + (data.remainingMs ?? data.durationMinutes * 60000));
  await proctorRef.current.arm({ fullscreenTarget: document.documentElement });   // fullscreen + camera here
  setPhase("running");
}
```

Reacting to strikes / auto-submit:

```jsx
p.on("strike", ({ count, limit, kind }) => setStrikes({ count, limit, lastKind: kind !== "server" ? kind : null }));
p.on("autosubmit", () => submit(true));
// timer: when remaining hits 0 → submit(false)
// autosave: every 10 s + on window blur → api.saveExamAnswers(id, dirtyBatch)
// on submit(): flushAnswers() → proctor.disarm() → api.submitExamAttempt(id) → SubmittedScreen
```

### 7.4 Admin review (`frontend/src/admin/AdminExamAttempts.jsx`)

Table of attempts (auto-submitted sorted first) → click **Review** → per-attempt
panel: metadata, the full `exam_events` timeline (kind / severity / source /
client vs server time / detail JSON), every answer next to its correct answer,
and a manual final-score field.

### 7.5 Vite alias (`frontend/vite.config.js`)

```js
resolve: {
  alias: {
    "@techspark/proctor-sdk": fileURLToPath(new URL("../proctor/sdk/src/index.js", import.meta.url)),
  },
},
server: { fs: { allow: [".."] } },   // dev: import from outside frontend/
```

The SDK is dependency-free ESM, so this works for `vite dev` **and** `vite build`
(the whole repo is present at build time, on Amplify too). If you move `proctor/`
out of the repo, publish `@techspark/proctor-sdk` and swap the alias for the
package name.

---

## 8. Signals reference

| kind | Source | Default severity | Detection | How defeatable |
| --- | --- | --- | --- | --- |
| `tab_blur` / `visibility_hidden` | SDK | strike | `visibilitychange`, `window.blur`, `hasFocus()` poll | nothing in-browser; a second device is invisible |
| `tab_switch` / `new_tab_opened` | extension | strike | `chrome.tabs` events | disable the extension → blocked by the handshake gate |
| `window_blur` | extension | strike | `chrome.windows.onFocusChanged` | as above |
| `nav_attempt` | extension | strike | `webNavigation.onBeforeNavigate` on the exam tab | as above |
| `fullscreen_exit` | SDK | strike | `fullscreenchange` while armed | can't stay out of fullscreen without tripping it |
| `multi_display` | extension / SDK | strike | `chrome.system.display.getInfo()` / `screen.isExtended` | unplug the second monitor (the point) |
| `paste_large` | SDK | strike | `paste` event, text ≥ threshold | type it manually (slower; `copy` still fires on the source) |
| `copy` `cut` `paste` `contextmenu` `blocked_shortcut` | SDK | warn | DOM events, `keydown` capture | some combos (Ctrl+T, Alt+Tab) never reach the page — the extension catches the result |
| `devtools` | SDK | warn (never auto-strike) | viewport delta + optional `debugger` timing | trivially; corroboration only |
| `no_face` | SDK | warn | webcam frame → detector; sustained absence | look at a second screen while staying in frame |
| `multi_face` | SDK | strike | detector count > 1 (needs a real model, §11) | keep the helper off-camera |
| `extension_lost` | SDK | strike | handshake channel drops mid-exam | — |
| `page_hidden` | SDK | info | `beforeunload` / `pagehide` | a reload can be legitimate; it sits next to a `seq` gap on the timeline |

**Out of scope** (needs an OS-level lockdown app à la Safe Exam Browser): a
second laptop or phone, a virtual machine, screen-sharing to a remote helper, OS
screenshot tools, disabling the camera at the driver level.

---

## 9. Install & run on the TechSpark site

```bash
# 1. backend env — add to backend/.env (see backend/.env.example)
JWT_EXAM_SECRET=$(openssl rand -hex 32)
EXAM_ATTEMPT_GRACE_MS=600000
PROCTOR_EXT_SHARED_SECRET=$(openssl rand -hex 32)

# 2. schema + sample exam
cd backend
npm run db:schema        # migrate.js also runs on every boot
npm run db:seed:exam     # creates exam slug "sample" + 4 questions
npm run dev

# 3. frontend
cd ../frontend
npm run dev

# 4. extension
#  - edit proctor/extension/config.js:  SHARED_SECRET = <same as backend>,  ALLOWED_ORIGINS
#  - edit proctor/extension/manifest.json host_permissions + content_scripts.matches to your origin
#  - chrome://extensions → Developer mode → Load unpacked → proctor/extension/
#  - (optional) set frontend/.env VITE_PROCTOR_EXTENSION_URL to the Web Store link

# 5. log in as a participant, open  /exam/sample
```

Admin review: log in as an `admin`, open `/admin/exam/sample` (also linked from
the dashboard header).

---

## 10. Reuse it on any site

The SDK and extension carry **zero** TechSpark specifics.

### Step 1 — get the SDK into your page

```bash
# option A: publish it
cd proctor/sdk && npm publish       # or GitHub Packages
# then:  npm i @techspark/proctor-sdk

# option B: vendor it — it's dependency-free ESM
cp -r proctor/sdk/src  your-app/src/proctor-sdk
```

Or, no bundler at all:

```html
<script type="module">
  import { Proctor } from "https://your-cdn/proctor-sdk/index.js";
  window.Proctor = Proctor;
</script>
```

### Step 2 — implement the two endpoints

`POST /start` — verify the proof, create an attempt, return the wiring:

```js
// pseudo-code, any language
app.post("/exam/:slug/start", auth, async (req, res) => {
  const { v, ts, sig } = req.body.extProof || {};
  const origin = req.headers.origin;
  const expected = hmacSha256Hex(process.env.PROCTOR_EXT_SHARED_SECRET, `${req.params.slug}|${origin}|${ts}|${v}`);
  if (!v || Math.abs(Date.now() - ts) > 120000 || !timingSafeEqual(sig, expected))
    return res.status(403).json({ error: "extension not verified" });

  const attempt = await db.createAttempt({ slug: req.params.slug, user: req.user.id });
  const signingKey = randomHex(32);
  await db.saveSigningKey(attempt.id, signingKey);
  res.json({
    attemptId: attempt.id,
    signingKey,
    ingestPath: `/exam/attempts/${attempt.id}/events`,
    strikeLimit: 3,
    remainingMs: 30 * 60 * 1000,
    questions: attempt.questions,      // strip correct answers!
  });
});
```

`POST <ingestPath>` — store, recount, decide:

```js
const SEVERITY = { tab_blur:"strike", tab_switch:"strike", new_tab_opened:"strike", window_blur:"strike",
  visibility_hidden:"strike", fullscreen_exit:"strike", nav_attempt:"strike", multi_display:"strike",
  paste_large:"strike", multi_face:"strike", extension_lost:"strike", camera_lost:"strike",
  copy:"warn", cut:"warn", paste:"warn", contextmenu:"warn", blocked_shortcut:"warn",
  devtools:"warn", no_face:"warn" };   // everything else → "info"   (mirror the SDK's DEFAULT_POLICY)

app.post("/exam/attempts/:id/events", auth, attemptAuth, async (req, res) => {
  const attempt = await db.getAttempt(req.params.id);
  await db.insertEvents(attempt.id, req.body.events.map((e) => ({ ...e, severity: SEVERITY[e.kind] || "info" })));

  const strikes = await db.countStrikeEvents(attempt.id);   // COUNT(*) WHERE severity='strike'
  const strikeLimit = attempt.strikeLimit;
  let autoSubmitted = false;
  if (attempt.status === "in_progress" && strikes >= strikeLimit) {
    await db.setStatus(attempt.id, "auto_submitted");
    autoSubmitted = true;
  }
  res.json({ strikes, strikeLimit, autoSubmitted });
});
```

> `req.body.sig` is an HMAC of `JSON.stringify(events)` with the attempt's
> `signingKey`. Verify it if you like — but the strike recount above is what
> actually protects you, so treat a mismatch as a flag, not a hard reject.

### Step 3 — rebuild the extension for your origins

Edit `proctor/extension/manifest.json` (`host_permissions` +
`content_scripts.matches`) and `proctor/extension/config.js` (`SHARED_SECRET`,
`ALLOWED_ORIGINS`), then zip and publish (§5.6).

### Step 4 — wire the page

```js
const p = Proctor.init({
  handshakeContext: examSlug,      // must match what you pass to POST /start
  strikeLimit: 3,
  requireExtension: true,
  camera: true,
});

const hs = await p.handshake();
if (hs.requiredButMissing) return showInstallGate();

startButton.onclick = async () => {                       // must be a user gesture
  const r = await fetch(`/exam/${examSlug}/start`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extProof: hs.proof }),
  }).then((x) => x.json());

  p.configure({ attemptId: r.attemptId, signingKey: r.signingKey, ingestUrl: r.ingestPath });
  p.on("strike", ({ count, limit }) => banner(`Warning ${count}/${limit}`));
  p.on("autosubmit", () => submitExam());
  await p.arm({ fullscreenTarget: document.documentElement });
  renderQuestions(r.questions);
};
```

That's the entire integration surface: **one SDK import, two endpoints, one
extension rebuild.**

---

## 11. Real webcam face-counting

The shipped `camera-face.js` fallback only detects a black/covered lens
(`no_face`). For real `multi_face` counting, plug in a model — bundle its files
locally (the exam page's CSP blocks third-party fetches):

```js
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");   // served by your app
const detector = await FaceDetector.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" },
  runningMode: "VIDEO",
});

const faceDetector = async (videoEl) => {
  const res = detector.detectForVideo(videoEl, performance.now());
  return { faces: res.detections.length };
};

Proctor.init({ /* … */, camera: { detector: faceDetector, sampleMs: 2000, noFaceGraceMs: 6000 } });
```

The monitor stores **only** the integer count + timestamp — it never captures,
draws, or uploads a frame.

---

## 12. Privacy, retention, limitations

- **Camera = face count only.** No video or photo is recorded, stored, or sent.
- **`exam_events`** holds behavioural signals + timestamps + small JSON details
  (e.g. `{ combo: "devtools_f12" }`). No page content, keystrokes, or screenshots.
- **Consent first.** Show the disclosure screen
  (`frontend/src/exam/ConsentScreen.jsx`) before `getUserMedia`; state your
  retention window; purge `exam_events` on a schedule (extend the interval-job
  pattern in `backend/src/utils/expireStaleRegistrations.js`).
- **Not unbreakable.** An extension can be avoided by using another browser or
  profile — the handshake gate raises the cost, it doesn't eliminate it.
- **No OS lockdown.** A second laptop/phone, a VM, or a remote helper on a
  screen-share are not detectable without a dedicated desktop app.
- **`devtools` is heuristic** — kept at `warn`, never an auto-strike, because it
  false-positives on docked panels and zoom.

---

## 13. Verification checklist

**Monitor, standalone (no backend):**
```bash
cd proctor/examples/demo-exam && python -m http.server 8080   # or: npx serve -l 8080
```
Open `http://localhost:8080`, load the extension, add `http://localhost:8080` to
its `host_permissions` + `matches`. Expect: handshake `READY {version}` in the
console; switching tabs / opening a tab / exiting fullscreen / `Ctrl+C` /
right-click each log an event; the 3rd strike-severity event fires
`onAutoSubmit`; covering the webcam logs `no_face` with **no image data** in the
payload.

**Backend (tested against a live MySQL DB during build):**
- `npm run db:schema` creates the 5 tables (`migrate.js` idempotent).
- `npm run db:seed:exam` seeds `slug: sample`.
- `POST /api/exam/sample/start` with a bad proof → **403**; with a valid proof →
  **200**, `remainingMs: 1800000`, and questions with **no `correct_answer`**.
- `POST …/events` ×3 strike events → response `autoSubmitted: true` on the 3rd;
  a following `POST …/answers` → **409**.
- Normal submit with correct answers → `auto_score` computed (mcq single +
  multi-select set-equality + case-insensitive short); coding left `NULL`.
- Admin: `GET /api/admin/exam/sample/attempts` lists it; detail shows the event
  timeline; `PATCH …/score` persists a manual score.

**Frontend:**
- `npm run dev`, log in as a participant, open `/exam/sample`.
- No extension → `ExtensionGate` blocks. With extension + camera → exam opens in
  fullscreen with a running timer.
- Alt-Tab / open a new tab ×3 → banner escalates 1→2→3 → auto-submit →
  `SubmittedScreen` (auto-submitted variant).
- Reload mid-exam → resumes with saved answers, correct remaining time, same
  strike count.
- An exam with `require_extension: false` runs in degraded SDK-only mode.
