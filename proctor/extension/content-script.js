// Isolated-world relay between the exam page (window.postMessage) and the
// background service worker (chrome.runtime Port).
//
//   page  --window.postMessage({source:"techspark-proctor",dir:"page"})-->  here
//   here  --port.postMessage-->  background
//   background  --port.postMessage-->  here
//   here  --window.postMessage({...,dir:"ext"})-->  page

const NS = "techspark-proctor";
let port = null;

function toPage(msg) {
  window.postMessage({ source: NS, dir: "ext", ...msg }, window.location.origin);
}

function connect() {
  try {
    port = chrome.runtime.connect({ name: "proctor" });
  } catch {
    toPage({ type: "EXT_GONE" });
    return;
  }
  port.onMessage.addListener((msg) => toPage(msg));
  port.onDisconnect.addListener(() => {
    port = null;
    toPage({ type: "EXT_GONE" });
    // The worker may have been recycled; try to re-establish shortly.
    setTimeout(connect, 1000);
  });
}

connect();

window.addEventListener("message", (ev) => {
  if (ev.source !== window) return;
  const msg = ev.data;
  if (!msg || msg.source !== NS || msg.dir !== "page") return;
  if (!port) connect();
  try {
    port?.postMessage({
      type: msg.type,
      context: msg.context,
      origin: msg.origin || window.location.origin,
    });
  } catch {
    toPage({ type: "EXT_GONE" });
  }
});
