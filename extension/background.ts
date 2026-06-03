import {
  type AuthResult,
  type CheckResult,
  type ExtensionMessage,
  MESSAGE_TYPES,
  NOTIFICATION_DURATION,
  type SaveResult,
  type Workspace,
} from "./constants.js";
import { getBaseUrl, getLastWorkspace, setLastWorkspace } from "./storage.js";

type NotificationType = "success" | "error" | "info";

interface NotificationConfigEntry {
  color: string;
  badge: string;
  priority: number;
}

const NOTIFICATION_CONFIG: Record<string, NotificationConfigEntry> = {
  success: { color: "#22c55e", badge: "\u2713", priority: 0 },
  error: { color: "#ef4444", badge: "!", priority: 2 },
  info: { color: "#6b7280", badge: "\u00b7", priority: 0 },
};

interface SessionCache {
  authenticated: boolean | null;
  workspaces: Workspace[] | null;
}

const sessionCache: SessionCache = {
  authenticated: null,
  workspaces: null,
};

const checkCache = new Map<string, Promise<CheckResult | null>>();
const CHECK_CACHE_TTL = 30_000;

async function getCachedCheck(
  workspaceId: string,
  url: string,
): Promise<CheckResult | null> {
  const key = `${workspaceId}::${url}`;
  const existing = checkCache.get(key);
  if (existing) return existing;

  const promise = checkBookmark({ url, workspaceId }).catch(() => null);
  checkCache.set(key, promise);

  setTimeout(() => {
    if (checkCache.get(key) === promise) checkCache.delete(key);
  }, CHECK_CACHE_TTL);

  return promise;
}

function invalidateCache(): void {
  sessionCache.authenticated = null;
  sessionCache.workspaces = null;
  checkCache.clear();
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  chrome.alarms.create("keepAlive", { periodInMinutes: 4 / 60 });
});

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name === "keepAlive") {
    void chrome.storage.local.get("keepAlive");
  }
});

chrome.commands.onCommand.addListener(async (command: string) => {
  if (command === "save-current-tab") {
    await saveCurrentTabWithNotification();
  }
});

async function saveCurrentTabWithNotification(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
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

    await handleSaveResult(result);
  } catch (error) {
    const e = error as { message?: string };
    showNotification("Error", e.message || "An error occurred", "error");
  }
}

function createContextMenus(): void {
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

chrome.contextMenus.onClicked.addListener(
  async (info: chrome.contextMenus.OnClickData) => {
    const url = info.linkUrl || info.pageUrl;

    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      showNotification("Cannot save", "This page cannot be saved", "error");
      return;
    }

    try {
      const lastWorkspace = await getLastWorkspace();
      const result = await handleSaveBookmark({
        url,
        title: null,
        workspaceId: lastWorkspace,
      });
      await handleSaveResult(result, lastWorkspace);
    } catch (error) {
      const e = error as { message?: string };
      showNotification("Error", e.message || "Failed to save", "error");
    }
  },
);

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (message.type === MESSAGE_TYPES.SAVE_BOOKMARK) {
      handleSaveBookmark(message.data)
        .then((result) => sendResponse(result))
        .catch((error: Error) =>
          sendResponse({ success: false, error: error.message }),
        );
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
        .catch((error: Error) => sendResponse({ error: error.message }));
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
        .catch((error: Error) =>
          sendResponse({ workspaces: [], error: error.message }),
        );
      return true;
    }

    if (message.type === MESSAGE_TYPES.X_BOOKMARK_CAPTURED) {
      handleXBookmark(message.url)
        .then((result) => sendResponse(result))
        .catch((error: Error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true;
    }

    if (message.type === MESSAGE_TYPES.CHECK_BOOKMARK) {
      checkBookmark(message.data)
        .then((result) => sendResponse(result))
        .catch(() => sendResponse({ saved: false }));
      return true;
    }

    if (message.type === MESSAGE_TYPES.CHECK_BOOKMARK_CACHED) {
      const { url, workspaceId } = message.data;
      if (!url || !workspaceId) {
        sendResponse({ saved: false });
        return;
      }
      getCachedCheck(workspaceId, url)
        .then((result) => sendResponse(result || { saved: false }))
        .catch(() => sendResponse({ saved: false }));
      return true;
    }

    if (message.type === MESSAGE_TYPES.CHECK_BOOKMARK_SETTLED) {
      const { url, workspaceId } = message.data;
      if (url && workspaceId) {
        const key = `${workspaceId}::${url}`;
        checkCache.set(key, Promise.resolve({ saved: true }));
        setTimeout(() => checkCache.delete(key), CHECK_CACHE_TTL);
      }
      sendResponse({ ok: true });
      return true;
    }
  },
);

function getWorkspaceName(
  workspaceId: string | null | undefined,
): string | null {
  if (!workspaceId || !sessionCache.workspaces) return null;
  const ws = sessionCache.workspaces.find((w) => w.id === workspaceId);
  return ws?.name ?? null;
}

async function resolveWorkspaceName(
  workspaceId: string | null | undefined,
): Promise<string | null> {
  const cached = getWorkspaceName(workspaceId);
  if (cached) return cached;
  if (!workspaceId) return null;
  try {
    const { workspaces } = await getWorkspaces();
    if (workspaces) {
      const ws = workspaces.find((w) => w.id === workspaceId);
      return ws?.name ?? null;
    }
  } catch {
    // silent
  }
  return null;
}

async function handleSaveResult(
  result: SaveResult,
  workspaceId?: string | null,
): Promise<void> {
  if (result.needsLogin) {
    showNotification("Login required", "Please log in first", "error");
    const baseUrl = await getBaseUrl();
    chrome.tabs.create({ url: `${baseUrl}/login` });
  } else if (result.duplicate) {
    const wsName = await resolveWorkspaceName(workspaceId);
    const message = wsName
      ? `Already saved in \u201c${wsName}\u201d`
      : "Already saved in this workspace";
    showNotification("Already saved", message, "info");
  } else if (result.success) {
    showNotification("Saved!", "Bookmark saved successfully", "success");
  } else {
    showNotification("Error", result.error || "Failed to save", "error");
  }
}

async function checkAuth(): Promise<AuthResult> {
  if (sessionCache.authenticated !== null) {
    return { authenticated: sessionCache.authenticated };
  }
  const baseUrl = await getBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/extension/auth`, {
      credentials: "include",
    });
    const data = (await response.json()) as AuthResult;
    sessionCache.authenticated = !!data.authenticated;
    return data;
  } catch {
    sessionCache.authenticated = false;
    return { authenticated: false };
  }
}

interface SaveBookmarkParams {
  url: string;
  title?: string | null;
  workspaceId?: string | null;
}

async function handleSaveBookmark({
  url,
  title,
  workspaceId,
}: SaveBookmarkParams): Promise<SaveResult> {
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

  const data = (await response.json()) as Record<string, unknown>;

  if (response.status === 409) return { success: false, duplicate: true };

  if (!response.ok)
    throw new Error((data.error as string) || "Failed to save bookmark");

  if (workspaceId) {
    await setLastWorkspace(workspaceId);
    invalidateCache();
  }

  return { success: true, ...data };
}

async function handleXBookmark(url: string): Promise<SaveResult> {
  const workspaceId = await getLastWorkspace();
  try {
    const result = await handleSaveBookmark({ url, workspaceId });
    await handleSaveResult(result, workspaceId);
    return result;
  } catch (error) {
    const e = error as { message?: string };
    console.error("[Sheltermark] X bookmark error:", error);
    showNotification("Error", e.message || "Failed to save", "error");
    return { success: false, error: e.message };
  }
}

function showNotification(
  title: string,
  message: string,
  type: NotificationType = "success",
): void {
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
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
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

interface GetWorkspacesResult {
  workspaces?: Workspace[];
  error?: string;
}

async function getWorkspaces(): Promise<GetWorkspacesResult> {
  if (sessionCache.workspaces) {
    return { workspaces: sessionCache.workspaces };
  }
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/extension/workspaces`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch workspaces");
  const data = (await response.json()) as GetWorkspacesResult;
  if (data.workspaces) sessionCache.workspaces = data.workspaces;
  return data;
}

interface CheckBookmarkParams {
  url: string;
  workspaceId?: string;
}

async function checkBookmark({
  url,
  workspaceId,
}: CheckBookmarkParams): Promise<CheckResult> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams({ url });
  if (workspaceId) params.set("workspace_id", workspaceId);

  const response = await fetch(
    `${baseUrl}/api/extension/check?${params.toString()}`,
    { credentials: "include" },
  );

  if (!response.ok) return { saved: false };
  return response.json() as Promise<CheckResult>;
}
