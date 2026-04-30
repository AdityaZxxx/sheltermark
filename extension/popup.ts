import {
  type AuthResult,
  type CheckResult,
  MESSAGE_TYPES,
  type TabInfo,
  type Workspace,
} from "./constants.js";

document.addEventListener("DOMContentLoaded", async () => {
  const { getBaseUrl, getLastWorkspace, setLastWorkspace } = await import(
    "./storage.js"
  );
  const baseUrl = await getBaseUrl();

  const authSection = document.getElementById("auth-section") as HTMLElement;
  const mainSection = document.getElementById("main-section") as HTMLElement;
  const workspaceSelect = document.getElementById(
    "workspace-select",
  ) as HTMLSelectElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
  const authBtn = document.getElementById("auth-btn") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLElement;

  let workspaces: Workspace[] = [];
  let selectedWorkspaceId: string | null = null;
  let currentTabInfo: TabInfo | null = null;
  let isSaved = false;
  let checkGeneration = 0;

  mainSection.classList.remove("hidden");

  const [auth, tabInfo] = await Promise.all([checkAuth(), getCurrentTabInfo()]);
  currentTabInfo = tabInfo;
  updateSaveButton();

  if (!auth.authenticated) {
    showAuthRequired();
    return;
  }

  await Promise.all([loadWorkspaces(), checkAlreadySaved()]);

  updateSaveButton();
  saveBtn.focus();

  authBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${baseUrl}/login` });
  });

  saveBtn.addEventListener("click", async () => {
    if (isSaved || saveBtn.disabled) return;

    const url = currentTabInfo?.url;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      showError("Cannot save this page");
      return;
    }

    isSaved = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saved!";
    showSuccess("Saved!");

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SAVE_BOOKMARK,
      data: {
        url,
        title: currentTabInfo?.title ?? null,
        workspaceId: selectedWorkspaceId,
      },
    });

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CHECK_BOOKMARK_SETTLED,
      data: { url, workspaceId: selectedWorkspaceId },
    });

    setTimeout(() => window.close(), 400);
  });

  workspaceSelect.addEventListener("change", async () => {
    selectedWorkspaceId = workspaceSelect.value || null;
    if (selectedWorkspaceId) {
      await setLastWorkspace(selectedWorkspaceId);
    }
    isSaved = false;
    updateSaveButton();
    checkAlreadySaved();
  });

  async function checkAuth(): Promise<AuthResult> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_AUTH,
      });
      return (response as AuthResult) || { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  }

  async function loadWorkspaces(): Promise<void> {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_WORKSPACES,
      })) as { workspaces?: Workspace[] };

      workspaces = response.workspaces || [];

      workspaceSelect.innerHTML = "";

      if (workspaces.length === 0) {
        workspaceSelect.classList.add("hidden");
        return;
      }

      if (workspaces.length === 1) {
        workspaceSelect.classList.add("hidden");
        selectedWorkspaceId = workspaces[0]?.id ?? null;
        await setLastWorkspace(selectedWorkspaceId);
        return;
      }

      const defaultWs = workspaces.find((w) => w.is_default);
      const lastUsed = await getLastWorkspace();

      workspaces.forEach((ws) => {
        const option = document.createElement("option");
        option.value = ws.id;
        option.textContent = ws.name + (ws.is_default ? " (Default)" : "");
        workspaceSelect.appendChild(option);
      });

      if (lastUsed && workspaces.some((w) => w.id === lastUsed)) {
        workspaceSelect.value = lastUsed;
        selectedWorkspaceId = lastUsed;
      } else if (defaultWs) {
        workspaceSelect.value = defaultWs.id;
        selectedWorkspaceId = defaultWs.id;
      } else {
        selectedWorkspaceId = workspaces[0]?.id ?? null;
      }
    } catch {
      workspaceSelect.innerHTML = '<option value="">Error loading</option>';
    }
  }

  async function checkAlreadySaved(): Promise<void> {
    const url = currentTabInfo?.url;
    if (!url || !selectedWorkspaceId) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;

    const generation = ++checkGeneration;

    try {
      const cached = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_BOOKMARK_CACHED,
        data: { url, workspaceId: selectedWorkspaceId },
      })) as CheckResult | undefined;

      if (generation !== checkGeneration) return;
      if (cached?.saved) {
        setAlreadySaved();
        return;
      }
    } catch {
      // fallback to network
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_BOOKMARK,
        data: { url, workspaceId: selectedWorkspaceId },
      })) as CheckResult | undefined;

      if (generation !== checkGeneration) return;

      if (response?.saved) {
        setAlreadySaved();
      } else {
        isSaved = false;
        saveBtn.disabled = false;
        updateSaveButton();
      }
    } catch {
      // silent
    }
  }

  function setAlreadySaved(): void {
    isSaved = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Already saved";
    statusDiv.textContent = "";
  }

  function updateSaveButton(): void {
    if (isSaved) return;
    const title = currentTabInfo?.title;
    if (title) {
      const truncated =
        title.length > 35 ? `${title.slice(0, 35)}\u2026` : title;
      saveBtn.textContent = `Save \u201c${truncated}\u201d`;
    } else {
      saveBtn.textContent = "Save Current Tab";
    }
  }

  function getCurrentTabInfo(): Promise<TabInfo | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: MESSAGE_TYPES.GET_TAB_INFO },
        (response: unknown) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve((response as TabInfo) ?? null);
          }
        },
      );
    });
  }

  function showAuthRequired(): void {
    authSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
  }

  function showError(msg: string): void {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#ef4444";
  }

  function showSuccess(msg: string): void {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#22c55e";
  }
});
