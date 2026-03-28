// Sheltermark Extension - Options Page

import { DEFAULT_BASE_URL } from "./constants.js";
import { getBaseUrl, setBaseUrl } from "./storage.js";

const baseUrlInput = document.getElementById("base-url");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");

let statusTimer = null;

function showStatus(message, isError = false) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.className = isError ? "error visible" : "visible";
  statusTimer = setTimeout(() => {
    statusEl.className = "";
  }, 2500);
}

async function load() {
  baseUrlInput.value = await getBaseUrl();
}

async function save() {
  const raw = baseUrlInput.value.trim();
  if (!raw) {
    showStatus("URL cannot be empty", true);
    return;
  }

  let normalized;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
    // Strip trailing slash for consistency
    normalized = parsed.href.replace(/\/$/, "");
  } catch {
    showStatus("Invalid URL", true);
    return;
  }

  await setBaseUrl(normalized);
  baseUrlInput.value = normalized;
  showStatus("Saved");
}

async function reset() {
  baseUrlInput.value = DEFAULT_BASE_URL;
  await setBaseUrl(DEFAULT_BASE_URL);
  showStatus("Reset to default");
}

saveBtn.addEventListener("click", save);
resetBtn.addEventListener("click", reset);
baseUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});

document.addEventListener("DOMContentLoaded", load);
