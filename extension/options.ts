import { DEFAULT_BASE_URL } from "./constants.js";
import { getBaseUrl, setBaseUrl } from "./storage.js";

const baseUrlInput = document.getElementById("base-url") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;

let statusTimer: ReturnType<typeof setTimeout> | null = null;

function showStatus(message: string, isError = false): void {
  if (statusTimer !== null) clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.className = isError ? "error visible" : "visible";
  statusTimer = setTimeout(() => {
    statusEl.className = "";
  }, 2500);
}

async function load(): Promise<void> {
  baseUrlInput.value = await getBaseUrl();
}

async function save(): Promise<void> {
  const raw = baseUrlInput.value.trim();
  if (!raw) {
    showStatus("URL cannot be empty", true);
    return;
  }

  let normalized: string;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
    normalized = parsed.href.replace(/\/$/, "");
  } catch {
    showStatus("Invalid URL", true);
    return;
  }

  await setBaseUrl(normalized);
  baseUrlInput.value = normalized;
  showStatus("Saved");
}

async function reset(): Promise<void> {
  baseUrlInput.value = DEFAULT_BASE_URL;
  await setBaseUrl(DEFAULT_BASE_URL);
  showStatus("Reset to default");
}

saveBtn.addEventListener("click", save);
resetBtn.addEventListener("click", reset);
baseUrlInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter") save();
});

document.addEventListener("DOMContentLoaded", load);
