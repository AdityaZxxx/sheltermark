// Sheltermark Chrome Extension - Background Service Worker

import { MESSAGE_TYPES, NOTIFICATION_DURATION } from "./constants.js";
import { getBaseUrl, getLastWorkspace, setLastWorkspace } from "./storage.js";

// Notification config — module-level constant, not recreated per call
const NOTIFICATION_CONFIG = {
  success: { color: "#22c55e", badge: "✓", priority: 0 },
  error: { color: "#ef4444", badge: "!", priority: 2 },
  info: { color: "#6b7280", badge: "·", priority: 0 },
};

// Initialize context menus on install
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-current-tab") {
    await saveCurrentTabWithNotification();
  }
});

async function saveCurrentTabWithNotification() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (
      !tab?.url ||
      (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
    ) {
      showNotification("Cannot save", "This page cannot be saved", "error");
      return;
    }

    const lastWorkspace = await getLastWorkspace();
    const result = await handleSaveBookmark({
      url: tab.url,
      title: tab.title ?? null,
      workspaceId: lastWorkspace,
    });

    handleSaveResult(result);
  } catch (error) {
    showNotification("Error", error.message || "An error occurred", "error");
  }
}

function createContextMenus() {
  chrome.contextMenus.create({
    id: "save-page",
    title: "Save to Sheltermark",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: "save-link",
    title: "Save link to Sheltermark",
    contexts: ["link"],
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info) => {
  const url = info.linkUrl || info.pageUrl;

  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    showNotification("Cannot save", "This page cannot be saved", "error");
    return;
  }

  try {
    const lastWorkspace = await getLastWorkspace();
    const result = await handleSaveBookmark({
      url,
      workspaceId: lastWorkspace,
    });
    handleSaveResult(result);
  } catch (error) {
    showNotification("Error", error.message || "Failed to save", "error");
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.SAVE_BOOKMARK) {
    handleSaveBookmark(message.data)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_TAB_INFO) {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs[0];
        sendResponse({
          url: tab?.url,
          title: tab?.title,
          favIconUrl: tab?.favIconUrl,
        });
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === MESSAGE_TYPES.CHECK_AUTH) {
    checkAuth()
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ authenticated: false }));
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_WORKSPACES) {
    getWorkspaces()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ workspaces: [], error: error.message }));
    return true;
  }

  if (message.type === MESSAGE_TYPES.X_BOOKMARK_CAPTURED) {
    handleXBookmark(message.url)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === MESSAGE_TYPES.CHECK_BOOKMARK) {
    checkBookmark(message.data)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ saved: false }));
    return true;
  }
});

// Shared result handler for keyboard shortcut and context menu paths
async function handleSaveResult(result) {
  if (result.needsLogin) {
    showNotification("Login required", "Please log in first", "error");
    const baseUrl = await getBaseUrl();
    chrome.tabs.create({ url: `${baseUrl}/login` });
  } else if (result.duplicate) {
    showNotification(
      "Already saved",
      "This URL is already in this workspace",
      "info",
    );
  } else if (result.success) {
    showNotification("Saved!", "Bookmark saved successfully", "success");
  } else {
    showNotification("Error", result.error || "Failed to save", "error");
  }
}

async function checkAuth() {
  const baseUrl = await getBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/extension/auth`, {
      credentials: "include",
    });
    return response.json();
  } catch {
    return { authenticated: false };
  }
}

async function handleSaveBookmark({ url, title, workspaceId }) {
  const baseUrl = await getBaseUrl();

  const response = await fetch(`${baseUrl}/api/extension/bookmark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      url,
      title: title ?? null,
      workspace_id: workspaceId,
    }),
  });

  if (response.status === 401) return { needsLogin: true };

  const data = await response.json();

  if (response.status === 409) return { success: false, duplicate: true };

  if (!response.ok) throw new Error(data.error || "Failed to save bookmark");

  if (workspaceId) await setLastWorkspace(workspaceId);

  return { success: true, ...data };
}

// Handle X/Twitter bookmark capture from content script
async function handleXBookmark(url) {
  const workspaceId = await getLastWorkspace();
  try {
    const result = await handleSaveBookmark({ url, workspaceId });
    handleSaveResult(result);
    return result;
  } catch (error) {
    console.error("[Sheltermark] X bookmark error:", error);
    showNotification("Error", error.message || "Failed to save", "error");
    return { success: false, error: error.message };
  }
}

// Show notification: type = 'success' | 'error' | 'info'
function showNotification(title, message, type = "success") {
  const { color, badge, priority } =
    NOTIFICATION_CONFIG[type] ?? NOTIFICATION_CONFIG.success;

  chrome.action.setBadgeText({ text: badge });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(
    () => chrome.action.setBadgeText({ text: "" }),
    NOTIFICATION_DURATION,
  );

  if (!chrome.notifications) return;

  const notificationId = `sheltermark-${Date.now()}`;
  chrome.notifications.create(
    notificationId,
    {
      type: "basic",
      title,
      message,
      iconUrl: "icons/icon-128.png",
      priority,
      silent: true,
    },
    (id) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Sheltermark] Notification failed:",
          chrome.runtime.lastError.message,
        );
        return;
      }
      setTimeout(() => chrome.notifications.clear(id), NOTIFICATION_DURATION);
    },
  );
}

async function getWorkspaces() {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/extension/workspaces`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch workspaces");
  return response.json();
}

async function checkBookmark({ url, workspaceId }) {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams({ url });
  if (workspaceId) params.set("workspace_id", workspaceId);

  const response = await fetch(
    `${baseUrl}/api/extension/check?${params.toString()}`,
    { credentials: "include" },
  );

  if (!response.ok) return { saved: false };
  return response.json();
}
