import { DEFAULT_BASE_URL } from "./constants.js";
import { getBaseUrl, setBaseUrl } from "./storage.js";

// SAFETY: options.html ships as a static document alongside this module; these
// ids are its contract. A missing element is a packaging bug — fail loudly at
// startup instead of dereferencing null on first interaction.
function requiredElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`[Sheltermark] options.html is missing ${selector}`);
  }
  return el;
}

const baseUrlInput = requiredElement<HTMLInputElement>("#base-url");
const saveBtn = requiredElement<HTMLButtonElement>("#save-btn");
const resetBtn = requiredElement<HTMLButtonElement>("#reset-btn");
const statusEl = requiredElement<HTMLElement>("#status");

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
