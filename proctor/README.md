# TechSpark Exam Proctor

A reusable browser proctoring monitor for online tests. Two parts:

| Part | Path | What it does |
| --- | --- | --- |
| **SDK** | `sdk/` | Runs *inside* the exam page. Detects tab/focus loss, fullscreen exit, clipboard, right-click, dev-tools shortcuts, extra monitors, and webcam face-presence. Batches signed events to your backend. Works with no extension in a degraded mode. |
| **Extension** | `extension/` | MV3 extension for Chrome/Edge. Adds the signals a page physically cannot see: real tab switches, new tabs, real window blur, authoritative multi-display, navigation-away attempts. Hands the page a signed "I'm here" proof. |
| **Demo** | `examples/demo-exam/` | A zero-backend page to develop and demo the monitor against. |

The design assumption: **the page refuses to start the exam without a verified
extension handshake, and the backend refuses to create an attempt without a
valid proof.** Neither half is unbreakable alone; together with a server-side
strike tally and a full admin audit trail they make casual cheating expensive
and obvious.

---

## 1. How the pieces talk

```
        exam page (React)                     MV3 extension
   ┌────────────────────────┐        ┌──────────────────────────────┐
   │  @techspark/proctor-sdk│        │ inject-main.js  (MAIN world) │  sets window.__PROCTOR_EXT__
   │                        │        │ content-script.js (isolated) │  <── window.postMessage ──> page
   │  monitors/*            │        │ background.js (service worker)│  chrome.tabs / windows /
   │  core/event-queue  ────┼──POST─▶│                              │  webNavigation / system.display
   │  bridge/extension-bridge│◀─────▶ └──────────────────────────────┘
   └───────────┬────────────┘
               │ POST /api/exam/attempts/:id/events   (batched, HMAC-signed)
               ▼
        your backend  ──  strike policy  ──  auto-submit at the limit
```

### Handshake

1. Page loads `@techspark/proctor-sdk` and calls `proctor.handshake()`.
2. The SDK checks `window.__PROCTOR_EXT__` (set synchronously by the extension's
   MAIN-world script) so it knows immediately whether an extension is installed.
3. It `postMessage`s `HELLO { context }` where `context` is a string the page
   already knows before an attempt exists — the **exam slug**.
4. The extension's service worker computes
   `proof = HMAC_SHA256(SHARED_SECRET, "<context>|<origin>|<ts>|<version>")`
   and replies `READY { version, proof, capabilities }`.
5. The page sends `proof` to `POST /api/exam/:slug/start`. The backend recomputes
   the HMAC (`PROCTOR_EXT_SHARED_SECRET`) and checks `ts` is recent. No match →
   `403`, no attempt created.

### Event stream

- Every monitor calls one `report(kind, detail)` funnel.
- `core/strike-engine.js` maps `kind → severity` (`info` / `warn` / `strike`) for
  instant "Warning 2/3" UI. **This is a mirror only.**
- `core/event-queue.js` batches events (~4 s, or an immediate flush on a
  `strike`), signs the batch with a per-attempt key from `/start`, and POSTs to
  the ingest URL. `navigator.sendBeacon` flushes on unload.
- The backend response `{ strikes, strikeLimit, autoSubmitted }` is
  **authoritative** and reconciles the local tally.

---

## 2. Signals, and how defeatable each one is

| kind | Source | Default severity | How it's detected | Bypass |
| --- | --- | --- | --- | --- |
| `tab_blur` / `visibility_hidden` | SDK | strike | `visibilitychange`, `window.blur`, `document.hasFocus()` poll | none in-browser; a second device is invisible |
| `tab_switch` / `new_tab_opened` | extension | strike | `chrome.tabs` events | disable the extension (blocked by the handshake gate) |
| `window_blur` | extension | strike | `chrome.windows.onFocusChanged` | as above |
| `nav_attempt` | extension | strike | `webNavigation.onBeforeNavigate` on the exam tab | as above |
| `fullscreen_exit` | SDK | strike | `fullscreenchange` while armed | can't stay out of fullscreen without tripping it |
| `multi_display` | extension / SDK | strike | `chrome.system.display.getInfo()` (authoritative) or `screen.isExtended` | unplug the second monitor (that's the point) |
| `paste_large` | SDK | strike | `paste` event, text length ≥ threshold | type it manually (slower, still leaves `copy` on the source) |
| `copy` `cut` `paste` `contextmenu` `blocked_shortcut` | SDK | warn | DOM events, `keydown` capture | some OS/browser combos (Ctrl+T, Alt+Tab) never reach the page — the extension catches the *result* |
| `devtools` | SDK | warn (never auto-strike) | viewport delta + optional `debugger` timing | trivially; kept as corroboration only |
| `no_face` | SDK | warn | webcam frame → face detector; sustained absence | point the camera away and stay in frame of a second screen |
| `multi_face` | SDK | strike | face detector count > 1 (needs a real model — see §5) | keep the helper off-camera |
| `extension_lost` | SDK | strike | handshake channel drops mid-exam | — |
| `page_hidden` | SDK | info | `beforeunload` / `pagehide` | reload is sometimes legitimate; it's on the timeline next to a `seq` gap |

**Out of scope** (needs an OS-level lockdown app like Safe Exam Browser): a
second laptop or phone, a virtual machine, screen-sharing to a remote helper,
OS screenshot tools, disabling the camera at the driver level.

---

## 3. Use it with the TechSpark site (already wired)

Backend (`../backend`):

1. `.env` — add `JWT_EXAM_SECRET` (required — without it every `/api/exam` route
   returns 503 and the rest of the API is unaffected) and `PROCTOR_EXT_SHARED_SECRET`
   (required for `require_extension` exams; **must equal** `extension/config.js` →
   `CONFIG.SHARED_SECRET`). `EXAM_ATTEMPT_GRACE_MS` is optional (default 600000).
   See `../backend/.env.example`.
2. `npm run db:schema` — creates the 5 exam tables (`migrate.js` also runs on every boot).
3. `npm run db:seed:exam` — seeds a sample exam (`slug: "sample"`) + questions.

Frontend (`../frontend`):

- Route `/exam/:slug` is registered in `src/App.jsx` behind `ParticipantRoute`.
- `src/proctor/proctorClient.js` wraps the SDK (aliased in `vite.config.js` to
  `../proctor/sdk/src`).
- Admin review at `/admin/exam/:slug` (`src/admin/AdminExamAttempts.jsx`).
- `.env` — optional `VITE_PROCTOR_EXTENSION_URL` (Web Store link for the gate).

Load a participant, open `/exam/sample`, install the extension (below), start.

---

## 4. Build / install the extension

No build step — it's plain MV3.

**Load unpacked (development)**

1. `chrome://extensions` → enable *Developer mode*.
2. *Load unpacked* → select `proctor/extension/`.
3. Copy the extension ID Chrome assigns.
4. Edit `extension/config.js`: set `SHARED_SECRET` (match the backend) and
   `ALLOWED_ORIGINS`. Edit `manifest.json` `host_permissions` +
   `content_scripts.matches` to your exam origin(s).
5. For the `file://` demo page: on the extension's card, enable *Allow access to
   file URLs* — or (better) serve the demo over `http://localhost` (see §6).

**Package / publish**

- `zip -r proctor-extension.zip extension/ -x '*.DS_Store'`
- Upload to the Chrome Web Store as an **unlisted** item to get a stable ID.
  Put that ID in the frontend `.env` (`VITE_PROCTOR_EXTENSION_URL`) so
  `ExtensionGate` links to it.
- Edge: the same zip uploads to Edge Add-ons unchanged.

---

## 5. Real webcam face counting

`sdk/src/monitors/camera-face.js` ships with a **luminance fallback** that only
detects a black/covered lens (`no_face`). For real `multi_face` counting, plug in
a model:

```js
// frontend/src/proctor/proctorClient.js
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision"; // bundle locally

const faceDetector = async (videoEl) => {
  const res = detector.detectForVideo(videoEl, performance.now());
  return { faces: res.detections.length };
};
```

Bundle the `.wasm` + `.tflite` with your app — the exam page's CSP blocks
third-party fetches. The monitor stores **only** the integer count + timestamp;
it never captures, draws, or uploads a frame.

---

## 6. Develop the monitor standalone (no backend)

```
cd proctor/examples/demo-exam
python -m http.server 8080      # or: npx serve -l 8080
```

Open `http://localhost:8080`. `demo.js` intercepts the ingest POST and simulates
the server's strike tally, so the full reconcile / auto-submit path runs with no
backend. Load the extension (§4) and add `http://localhost:8080` to its
`host_permissions` / `matches` to exercise the browser-level signals.

---

## 7. Reuse on another site

The SDK and extension are origin-parameterised — no TechSpark specifics in
either.

1. **Publish the SDK** (`npm publish` from `sdk/`, or GitHub Packages) or vendor
   `sdk/src` into your app. It's dependency-free ESM.
2. **Implement two endpoints:**
   - `POST /start` — verify the extension proof
     (`HMAC_SHA256(secret, "<context>|<origin>|<ts>|<version>")`, `ts` fresh),
     create an attempt, return `{ attemptId, signingKey, ingestPath, strikeLimit }`.
     Reference: `../backend/src/services/extensionProof.js`,
     `../backend/src/controllers/exam.controller.js` → `startAttempt`.
   - `POST <ingestPath>` — accept `{ attemptId, events[], sig }`, map each `kind`
     to a severity (`../backend/src/services/strikePolicy.js` →
     `SEVERITY_BY_KIND`, keep in sync with the SDK's `DEFAULT_POLICY`), tally
     strikes **from the stored events** (not a running counter), auto-submit at
     the limit, and return `{ strikes, strikeLimit, autoSubmitted }`.
3. **Rebuild the extension** with your origins in `manifest.json` +
   `config.js`, and your `SHARED_SECRET`.
4. Init the SDK: `Proctor.init({ handshakeContext: examSlug, strikeLimit,
   requireExtension: true, camera: true })`, then after `/start`:
   `p.configure({ attemptId, signingKey, ingestUrl })`, then `await p.arm()`
   from a user gesture.

---

## 8. Privacy & retention

- Camera: face **count** only. No video/photo is recorded, stored, or sent.
- `exam_events` holds behavioural signals + timestamps + small JSON details
  (e.g. `{ combo: "devtools_f12" }`). No page content, keystrokes, or
  screenshots.
- Show the consent screen (`frontend/src/exam/ConsentScreen.jsx`) before
  `getUserMedia`. State your retention window and purge `exam_events` on a
  schedule (the backend already runs an interval job pattern in
  `backend/src/utils/expireStaleRegistrations.js` you can extend).
