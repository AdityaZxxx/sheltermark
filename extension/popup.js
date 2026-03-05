// Sheltermark Chrome Extension - Popup Script

document.addEventListener("DOMContentLoaded", async () => {
  const { getBaseUrl, getLastWorkspace, setLastWorkspace } = await import(
    "./storage.js"
  );
  const { MESSAGE_TYPES } = await import("./constants.js");
  const baseUrl = await getBaseUrl();

  const authSection = document.getElementById("auth-section");
  const mainSection = document.getElementById("main-section");
  const workspaceSelect = document.getElementById("workspace-select");
  const saveBtn = document.getElementById("save-btn");
  const authBtn = document.getElementById("auth-btn");
  const statusDiv = document.getElementById("status");

  let workspaces = [];
  let selectedWorkspaceId = null;
  let currentTabInfo = null;
  let isSaved = false;
  // Generation counter prevents stale checkAlreadySaved responses from applying
  let checkGeneration = 0;

  // Fetch tab info + auth in parallel — no sequential waiting
  const [auth, tabInfo] = await Promise.all([checkAuth(), getCurrentTabInfo()]);
  currentTabInfo = tabInfo;

  if (!auth.authenticated) {
    showAuthRequired();
    return;
  }

  showMainSection();
  await loadWorkspaces();
  updateSaveButton();

  // Keyboard-first: focus save button immediately
  saveBtn.focus();

  // Non-blocking: check already-saved state after UI is ready
  checkAlreadySaved();

  // Auth button
  authBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${baseUrl}/login` });
  });

  // Save button
  saveBtn.addEventListener("click", async () => {
    if (isSaved || saveBtn.disabled) return;

    const url = currentTabInfo?.url;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      showError("Cannot save this page");
      return;
    }

    // Instant feedback — disable button while in-flight
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    statusDiv.textContent = "";

    let result;
    try {
      result = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SAVE_BOOKMARK,
        data: {
          url,
          title: currentTabInfo?.title ?? null,
          workspaceId: selectedWorkspaceId,
        },
      });
    } catch {
      // SW unavailable — re-enable so user can retry
      saveBtn.disabled = false;
      updateSaveButton();
      showError("Extension error, try again");
      return;
    }

    if (result?.duplicate) {
      // Stay open — give clear in-popup feedback
      isSaved = true;
      saveBtn.textContent = "Already saved";
      showInfo("Already saved in this workspace");
      return;
    }

    if (result?.needsLogin) {
      saveBtn.disabled = false;
      updateSaveButton();
      showError("Session expired — please log in again");
      return;
    }

    if (!result?.success) {
      saveBtn.disabled = false;
      updateSaveButton();
      showError(result?.error || "Failed to save");
      return;
    }

    // Happy path — close after brief confirmation
    isSaved = true;
    showSuccess("Saved!");
    setTimeout(() => window.close(), 900);
  });

  // Workspace change — re-check saved state for new workspace
  workspaceSelect.addEventListener("change", async () => {
    selectedWorkspaceId = workspaceSelect.value || null;
    if (selectedWorkspaceId) {
      await setLastWorkspace(selectedWorkspaceId);
    }
    isSaved = false;
    updateSaveButton();
    checkAlreadySaved();
  });

  async function checkAuth() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_AUTH,
      });
      return response || { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  }

  async function loadWorkspaces() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_WORKSPACES,
      });
      workspaces = response.workspaces || [];

      workspaceSelect.innerHTML = "";

      if (workspaces.length === 0) {
        workspaceSelect.classList.add("hidden");
        return;
      }

      // Single workspace — hide the select, no decision needed
      if (workspaces.length === 1) {
        workspaceSelect.classList.add("hidden");
        selectedWorkspaceId = workspaces[0].id;
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

  async function checkAlreadySaved() {
    const url = currentTabInfo?.url;
    if (!url || !selectedWorkspaceId) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;

    // Capture generation before async call — discard stale responses
    const generation = ++checkGeneration;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_BOOKMARK,
        data: { url, workspaceId: selectedWorkspaceId },
      });

      // If workspace changed while request was in-flight, ignore this response
      if (generation !== checkGeneration) return;

      if (response?.saved) {
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
      // Non-critical — silently fail, user can still try to save
    }
  }

  function updateSaveButton() {
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

  function getCurrentTabInfo() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: MESSAGE_TYPES.GET_TAB_INFO },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  function showAuthRequired() {
    authSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
  }

  function showMainSection() {
    authSection.classList.add("hidden");
    mainSection.classList.remove("hidden");
  }

  function showError(msg) {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#ef4444";
  }

  function showInfo(msg) {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#6b7280";
  }

  function showSuccess(msg) {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#22c55e";
  }
});
