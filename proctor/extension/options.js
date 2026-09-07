import { CONFIG } from "./config.js";

const ta = document.getElementById("origins");
const status = document.getElementById("status");

chrome.storage.local.get("origins").then(({ origins }) => {
  ta.value = (origins || CONFIG.ALLOWED_ORIGINS).join("\n");
});

document.getElementById("save").addEventListener("click", async () => {
  const origins = ta.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  await chrome.storage.local.set({ origins });
  status.textContent = "Saved.";
  setTimeout(() => (status.textContent = ""), 1500);
});
