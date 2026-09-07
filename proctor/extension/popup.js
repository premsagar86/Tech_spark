import { CONFIG } from "./config.js";

document.getElementById("ver").textContent = "v" + CONFIG.VERSION;

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const armedEl = document.getElementById("armed");
  const inScope =
    tab &&
    CONFIG.ALLOWED_ORIGINS.some((o) => (tab.url || "").startsWith(o + "/") || (tab.url || "").startsWith(o + ":"));
  armedEl.textContent = inScope ? "yes" : "no";
  armedEl.className = inScope ? "ok" : "muted";

  const dispEl = document.getElementById("disp");
  try {
    const infos = await chrome.system.display.getInfo();
    dispEl.textContent = String(infos.length);
    dispEl.className = infos.length > 1 ? "bad" : "ok";
  } catch {
    dispEl.textContent = "n/a";
  }
}

refresh();
