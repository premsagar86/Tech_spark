// MV3 service worker. Watches whichever tab(s) are running an exam and reports
// browser-level integrity signals the page itself cannot observe:
//   tab_switch      — user activated a different tab
//   new_tab_opened  — a new tab was created during the exam
//   window_blur     — focus left the exam's browser window (real, not a guess)
//   nav_attempt     — a top-frame navigation away from the exam origin
//   multi_display   — more than one monitor connected (authoritative)
//
// Communication is via a per-tab Port from content-script.js. The Port also
// keeps the worker alive for the duration of the exam.

import { CONFIG } from "./config.js";

/** @type {Map<number, { port: chrome.runtime.Port, origin: string, windowId: number, armed: boolean }>} */
const examTabs = new Map();

// ---- handshake proof --------------------------------------------------------

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeProof(context, origin) {
  const ts = Date.now();
  // `context` is a stable string the page knows before the attempt exists
  // (the exam slug). The backend recomputes
  //   hmac(secret, `${context}|${origin}|${ts}|${version}`)
  // and checks `Date.now() - ts <= PROOF_TTL_MS`.
  const sig = await hmacHex(CONFIG.SHARED_SECRET, `${context}|${origin}|${ts}|${CONFIG.VERSION}`);
  return { v: CONFIG.VERSION, ts, sig };
}

// ---- capabilities ---------------------------------------------------------

async function currentCapabilities() {
  const caps = ["tab_switch", "new_tab_opened", "window_blur", "nav_attempt"];
  if (chrome.system?.display) caps.push("multi_display");
  const mgmt = await chrome.permissions.contains({ permissions: ["management"] }).catch(() => false);
  if (mgmt) caps.push("risky_extension");
  return caps;
}

// ---- per-tab watchers ---------------------------------------------------------

function send(tabId, kind, detail = {}) {
  const entry = examTabs.get(tabId);
  if (!entry || !entry.armed) return;
  try {
    entry.port.postMessage({ type: "EVENT", kind, detail, clientTs: Date.now() });
  } catch {
    /* port gone; onDisconnect will clean up */
  }
}

async function reportDisplays(tabId) {
  if (!chrome.system?.display) return;
  try {
    const infos = await chrome.system.display.getInfo();
    if (infos.length > 1) send(tabId, "multi_display", { screens: infos.length });
  } catch {
    /* ignore */
  }
}

// Global listeners, registered once, that fan out to every armed exam tab.

chrome.tabs.onActivated.addListener((info) => {
  for (const [tabId, entry] of examTabs) {
    if (!entry.armed) continue;
    if (info.tabId !== tabId) send(tabId, "tab_switch", { toTabId: info.tabId });
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  for (const [tabId, entry] of examTabs) {
    if (entry.armed && tab.id !== tabId) send(tabId, "new_tab_opened", { url: tab.pendingUrl || tab.url || "" });
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  for (const [tabId, entry] of examTabs) {
    if (!entry.armed) continue;
    if (windowId === chrome.windows.WINDOW_ID_NONE || windowId !== entry.windowId) {
      send(tabId, "window_blur", { focusedWindow: windowId });
    }
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  const entry = examTabs.get(details.tabId);
  if (!entry || !entry.armed) return;
  let sameOrigin = false;
  try {
    sameOrigin = new URL(details.url).origin === entry.origin;
  } catch {
    /* treat unparseable as off-origin */
  }
  if (!sameOrigin) send(details.tabId, "nav_attempt", { url: details.url });
});

if (chrome.system?.display) {
  chrome.system.display.onDisplayChanged.addListener(() => {
    for (const [tabId, entry] of examTabs) if (entry.armed) reportDisplays(tabId);
  });
}

chrome.tabs.onRemoved.addListener((tabId) => examTabs.delete(tabId));

// ---- port wiring ------------------------------------------------------------

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "proctor") return;
  const tabId = port.sender?.tab?.id;
  const windowId = port.sender?.tab?.windowId;
  const origin = port.sender?.origin || (port.sender?.url ? new URL(port.sender.url).origin : null);
  if (tabId == null) return;

  examTabs.set(tabId, { port, origin, windowId, armed: false });

  port.onMessage.addListener(async (msg) => {
    const entry = examTabs.get(tabId);
    if (!entry) return;

    if (msg.type === "HELLO") {
      const proof = await makeProof(msg.context || "", entry.origin || origin || "");
      port.postMessage({
        type: "READY",
        version: CONFIG.VERSION,
        proof,
        capabilities: await currentCapabilities(),
      });
    } else if (msg.type === "ARM") {
      entry.armed = true;
      reportDisplays(tabId);
    } else if (msg.type === "DISARM") {
      entry.armed = false;
    }
  });

  port.onDisconnect.addListener(() => examTabs.delete(tabId));
});
