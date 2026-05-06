import {
  MESSAGE_TYPES,
  type PopupInfo,
  type TabInfo,
  type Workspace,
} from "./constants.js";

document.addEventListener("DOMContentLoaded", async () => {
  const { getBaseUrl, getLastWorkspace, setLastWorkspace } = await import(
    "./storage.js"
  );

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
  let currentUrl: string | null = null;

  mainSection.classList.remove("hidden");

  authBtn.addEventListener("click", async () => {
    const baseUrl = await getBaseUrl();
    void chrome.tabs.create({ url: `${baseUrl}/login` });
  });

  currentTabInfo = await getCurrentTabInfo();
  currentUrl = currentTabInfo?.url ?? null;

  await initPopup();

  updateSaveButton();
  saveBtn.focus();

  async function initPopup(): Promise<void> {
    const lastWorkspace = await getLastWorkspace();

    let popupInfo: PopupInfo;
    try {
      popupInfo = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_POPUP,
        data: { url: currentUrl ?? "", workspaceId: lastWorkspace },
      })) as PopupInfo;
    } catch {
      statusDiv.textContent = "Failed to load";
      statusDiv.style.color = "#ef4444";
      return;
    }

    if (!popupInfo.authenticated) {
      showAuthRequired();
      return;
    }

    workspaces = popupInfo.workspaces ?? [];

    workspaceSelect.innerHTML = "";

    if (workspaces.length === 0) {
      workspaceSelect.classList.add("hidden");
      return;
    }

    if (workspaces.length === 1) {
      workspaceSelect.classList.add("hidden");
      selectedWorkspaceId = workspaces[0]?.id ?? null;
      await setLastWorkspace(selectedWorkspaceId);
    } else {
      const defaultWs = workspaces.find((w) => w.is_default);

      workspaces.forEach((ws) => {
        const option = document.createElement("option");
        option.value = ws.id;
        option.textContent = ws.name + (ws.is_default ? " (Default)" : "");
        workspaceSelect.appendChild(option);
      });

      if (
        popupInfo.lastWorkspace &&
        workspaces.some((w) => w.id === popupInfo.lastWorkspace)
      ) {
        workspaceSelect.value = popupInfo.lastWorkspace;
        selectedWorkspaceId = popupInfo.lastWorkspace;
      } else if (defaultWs) {
        workspaceSelect.value = defaultWs.id;
        selectedWorkspaceId = defaultWs.id;
      } else {
        selectedWorkspaceId = workspaces[0]?.id ?? null;
      }
    }

    isSaved = popupInfo.alreadySaved;
    updateSaveButton();
  }

  saveBtn.addEventListener("click", async () => {
    if (isSaved || saveBtn.disabled || !currentUrl) return;

    isSaved = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saved!";
    showSuccess("Saved!");

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SAVE_BOOKMARK,
      data: {
        url: currentUrl,
        title: currentTabInfo?.title ?? null,
        workspaceId: selectedWorkspaceId,
      },
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

    if (!currentUrl || !selectedWorkspaceId) return;

    try {
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_BOOKMARK,
        data: { url: currentUrl, workspaceId: selectedWorkspaceId },
      })) as { saved?: boolean };

      if (result.saved) {
        isSaved = true;
        saveBtn.disabled = true;
        saveBtn.textContent = "Already saved";
        statusDiv.textContent = "";
      } else {
        isSaved = false;
        saveBtn.disabled = false;
        updateSaveButton();
      }
    } catch {
      // silent
    }
  });

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

  async function refreshAuthAndShowMain(): Promise<void> {
    currentTabInfo = await getCurrentTabInfo();
    currentUrl = currentTabInfo?.url ?? null;
    await initPopup();
    updateSaveButton();
    saveBtn.focus();
  }

  window.addEventListener("focus", refreshAuthAndShowMain);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAuthAndShowMain();
    }
  });

  function showSuccess(msg: string): void {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#22c55e";
  }
});
