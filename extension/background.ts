import {
  type CheckResult,
  type ExtensionMessage,
  type GetWorkspacesResult,
  MESSAGE_TYPES,
  NOTIFICATION_DURATION,
  type PopupInfo,
  type SaveEntrySource,
  type SaveResult,
  type TabInfo,
  type TagsResult,
  type TagWithCount,
  type Workspace,
} from "./constants.js";
import {
  drain,
  drainOnStartup,
  enqueue,
  installHeartbeat,
  isHeartbeatAlarm,
  type PostOutcome,
  parseRetryAfter,
  pauseQueue,
  type QueueHookContext,
  resumeQueue,
} from "./queue.js";
import {
  checkResultSchema,
  extensionMessageSchema,
  getWorkspacesResultSchema,
  popupInfoSchema,
  tagsResultSchema,
} from "./schema.js";
import {
  clearDataCaches,
  getBaseUrl,
  getCachedTags,
  getCachedWorkspaces,
  getLastWorkspace,
  isCacheStale,
  setCachedTags,
  setCachedWorkspaces,
  setLastWorkspace,
  STORAGE_KEYS,
} from "./storage.js";

type NotificationType = "success" | "error" | "info";

interface NotificationConfigEntry {
  color: string;
  badge: string;
  priority: number;
}

const NOTIFICATION_CONFIG = {
  success: { color: "#22c55e", badge: "\u2713", priority: 0 },
  error: { color: "#ef4444", badge: "!", priority: 2 },
  info: { color: "#6b7280", badge: "\u00b7", priority: 0 },
} as const satisfies Record<NotificationType, NotificationConfigEntry>;

interface SessionCache {
  workspaces: Workspace[] | null;
}

const sessionCache: SessionCache = {
  workspaces: null,
};

/** Every payload this worker answers with through sendResponse. */
type ExtensionResponse =
  | SaveResult
  | TabInfo
  | CheckResult
  | PopupInfo
  | TagsResult
  | { error: string };

function invalidateCache(): void {
  sessionCache.workspaces = null;
  void clearDataCaches();
  // Re-warm immediately so the next popup open is still cache-fast. Tag
  // counts changed with the save; the workspaces re-fetch piggybacks.
  void revalidateCaches();
}

// Queue hook wiring. Declared early because it's referenced by the top-level
// wake handler and the heartbeat before the function bodies below are reached.
// All referenced functions (postBookmarkRaw, showNotification, getBaseUrl) are
// function declarations and hoist, so this const can be initialized here.
const queueHooks: QueueHookContext = {
  postBookmark: (item) =>
    postBookmarkRaw({
      url: item.url,
      title: item.title,
      workspaceId: item.workspaceId,
      tags: item.tags,
    }),
  notifyOfflineQueued: (count) => {
    showNotification(
      "Saved offline",
      `${count} bookmark${count === 1 ? "" : "s"} queued — will sync.`,
      "info",
    );
  },
  notifySynced: (count) => {
    showNotification(
      "Synced",
      `${count} bookmark${count === 1 ? "" : "s"} synced.`,
      "success",
    );
  },
  notifyPermanentFailure: (url, reason) => {
    showNotification("Couldn't save", `${reason}: ${url}`, "error");
  },
  onAuthPaused: () => {
    void (async () => {
      showNotification("Login required", "Please log in first", "error");
      const baseUrl = await getBaseUrl();
      await chrome.tabs.create({ url: `${baseUrl}/login` });
    })();
  },
};

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  installHeartbeat();
});

// baseUrl can change at runtime (options page). The in-memory workspace cache
// is not keyed per baseUrl, so a stale entry from the previous server would
// otherwise leak into the next popup. Drop it whenever baseUrl is written;
// the per-baseUrl chrome.storage.session caches self-invalidate on read.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (STORAGE_KEYS.BASE_URL in changes) {
    sessionCache.workspaces = null;
  }
});

// Worker (re)start: recover any in_flight items (worker killed mid-POST) back
// to pending, sweep expired dead items, then drain. Must run before any drain.
chrome.runtime.onStartup.addListener(async () => {
  await drainOnStartup();
  await drain(queueHooks);
});

// Service workers have no reliable "warm start vs cold start" hook beyond
// onStartup. The module top-level runs on every service-worker wake, so kick a
// recovery+drain here too — drain() is a no-op if nothing is due (and
// drainOnStartup is idempotent). This covers the case where the worker woke
// for an unrelated reason (message, alarm) with items already in the queue.
void (async () => {
  await drainOnStartup();
  await drain(queueHooks);
})();

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (isHeartbeatAlarm(alarm.name)) {
    void drain(queueHooks);
    void revalidateCaches();
  }
});

/**
 * Keep popup data warm in chrome.storage.session. Called from the 1-minute
 * heartbeat, from every successful server response that carries fresh data,
 * and after mutations. Never throws — cache warmup is best-effort.
 */
async function revalidateCaches(): Promise<void> {
  await Promise.allSettled([
    (async () => {
      const cached = await getCachedWorkspaces();
      if (cached && !(await isCacheStale(cached))) return;
      const { workspaces } = await fetchWorkspacesRaw();
      if (workspaces) await setCachedWorkspaces(workspaces);
    })(),
    (async () => {
      const cached = await getCachedTags();
      if (cached && !(await isCacheStale(cached))) return;
      const tags = await fetchTagsRaw();
      await setCachedTags(tags);
    })(),
  ]);
}

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
    const outcome = await saveOrEnqueue("command", {
      url: tab.url,
      // Fast flows don't author an explicit title; sending null keeps the
      // metadata-driven behavior the user had before title precedence flipped.
      title: null,
      workspaceId: lastWorkspace,
    });
    await handleSaveOutcome(outcome, lastWorkspace);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An error occurred";
    showNotification("Error", message, "error");
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
      const outcome = await saveOrEnqueue("contextmenu", {
        url,
        title: null,
        workspaceId: lastWorkspace,
      });
      await handleSaveOutcome(outcome, lastWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      showNotification("Error", message, "error");
    }
  },
);

chrome.runtime.onMessage.addListener(
  (
    rawMessage: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: ExtensionResponse) => void,
  ) => {
    // Messages arrive untyped across the extension runtime; any payload that
    // fails the contract is ignored rather than half-handled.
    const parsedMessage = extensionMessageSchema.safeParse(rawMessage);
    if (!parsedMessage.success) return false;
    const message = parsedMessage.data;

    if (message.type === MESSAGE_TYPES.SAVE_BOOKMARK) {
      const { url, title, workspaceId, tags } = message.data;
      saveOrEnqueue("popup", { url, title, workspaceId, tags })
        .then((outcome) => sendResponse(saveOutcomeToSaveResult(outcome)))
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

    if (message.type === MESSAGE_TYPES.GET_TAGS) {
      getTags()
        .then((tags) => sendResponse({ authenticated: true, tags }))
        .catch(() => sendResponse({ authenticated: false, tags: [] }));
      return true;
    }

    if (message.type === MESSAGE_TYPES.GET_POPUP) {
      getPopupInfo(message.data)
        .then(async (result) => {
          // A successful, authenticated popup read means the user is signed in.
          // If the save queue was paused by a 401, resume it now — this survives
          // popup destruction (the popup's wasAuthenticated is per-session and
          // resets on open, so the background must own the resume). Fire-and-
          // forget: the popup doesn't need the resume result to render.
          if (result.authenticated) {
            void resumeQueue().then(() => drain(queueHooks));
          }
          if (result.authenticated && result.workspaces) {
            sessionCache.workspaces = result.workspaces;
            void setCachedWorkspaces(result.workspaces);
          }
          return result;
        })
        .then((result) => sendResponse(result))
        .catch(() =>
          sendResponse({
            authenticated: false,
            workspaces: [],
            lastWorkspace: null,
            alreadySaved: false,
            bookmarkId: null,
          }),
        );
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

interface SaveBookmarkParams {
  url: string;
  title?: string | null;
  workspaceId?: string | null;
  tags?: string[];
}

/**
 * Single fetch primitive. Used both:
 *   - inline (fast path) by the entry points, and
 *   - on retry by the queue (via the `postBookmark` adapter below).
 * Resolves baseUrl at call time and never throws on the network path — it
 * returns a structured PostOutcome so callers (queue + entry points) can
 * classify the outcome themselves.
 */
async function postBookmarkRaw({
  url,
  title,
  workspaceId,
  tags,
}: SaveBookmarkParams): Promise<PostOutcome> {
  const baseUrl = await getBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/extension/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        url,
        title: title ?? null,
        workspace_id: workspaceId,
        tags: tags ?? [],
      }),
    });
  } catch (err) {
    return {
      fetchThrew: true,
      status: null,
      errorMessage: err instanceof Error ? err.message : "Network error",
    };
  }
  console.debug(`[Sheltermark] Bookmark API response`, {
    status: response.status,
    statusText: response.statusText,
  });
  const retryAfterHeader = response.headers.get("Retry-After");
  return {
    fetchThrew: false,
    status: response.status,
    retryAfterHeader,
  };
}

// Entry points call saveOrEnqueue(): it does everything inline first so the
// existing happy-path notifications ("Saved!" / "Already saved" / "Login
// required") fire exactly as before. Only on a network failure (transient/
// auth/permanent) does it enqueue the intent — persistence, not the network
// request, is now the save guarantee.

export type SaveOutcome =
  | { kind: "ok" }
  | { kind: "duplicate" }
  | { kind: "needs_login" } // 401: existing login flow + queue paused
  | { kind: "queued"; reason: "offline" | "auth" | "permanent" }
  | { kind: "error"; message: string }; // inline permanent failure surfaced directly

async function saveOrEnqueue(
  source: SaveEntrySource,
  params: SaveBookmarkParams,
): Promise<SaveOutcome> {
  const outcome = await postBookmarkRaw(params);

  if (!outcome.fetchThrew) {
    const status = outcome.status ?? 0;
    if (status >= 200 && status < 300) {
      if (params.workspaceId) {
        await setLastWorkspace(params.workspaceId);
        invalidateCache();
      }
      return { kind: "ok" };
    }
    if (status === 409) return { kind: "duplicate" };
    if (status === 401) {
      await enqueue(
        {
          url: params.url,
          title: params.title ?? null,
          workspaceId: params.workspaceId ?? null,
          tags: params.tags ?? [],
          source,
        },
        { notifyOfflineQueued: () => undefined },
      );
      await pauseQueue();
      await handleSaveResult({ needsLogin: true });
      return { kind: "needs_login" };
    }
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      // Permanent inline failure (e.g. 400 bad URL). Enqueue so it follows the
      // dead-letter path uniformly (gets a permanent notification + TTL cleanup).
      await enqueue(
        {
          url: params.url,
          title: params.title ?? null,
          workspaceId: params.workspaceId ?? null,
          tags: params.tags ?? [],
          source,
        },
        { notifyOfflineQueued: () => undefined },
      );
      // Drain once to classify it dead immediately and notify.
      void drain(queueHooks);
      return { kind: "queued", reason: "permanent" };
    }
  }

  // Transient (network drop / 408 / 429 / 5xx): enqueue seeded with the failed
  // first attempt + backoff (or 429's Retry-After), fire the one quiet
  // "Saved offline — will sync" notification, then return. The heartbeat (or
  // onStartup resume) drains it.
  await enqueue(
    {
      url: params.url,
      title: params.title ?? null,
      workspaceId: params.workspaceId ?? null,
      tags: params.tags ?? [],
      source,
      seedFailedAttempt: {
        status: outcome.status,
        errorMessage: outcome.fetchThrew
          ? (outcome.errorMessage ?? null)
          : null,
        retryAfterMs:
          outcome.status === 429
            ? (parseRetryAfter(outcome.retryAfterHeader ?? null) ?? undefined)
            : undefined,
      },
    },
    { notifyOfflineQueued: queueHooks.notifyOfflineQueued },
  );
  return { kind: "queued", reason: "offline" };
}

/** Inline outcome → notification (mirrors the prior handleSaveResult happy path). */
async function handleSaveOutcome(
  outcome: SaveOutcome,
  workspaceId?: string | null,
): Promise<void> {
  switch (outcome.kind) {
    case "ok":
      showNotification("Saved!", "Bookmark saved successfully", "success");
      break;
    case "duplicate": {
      const wsName = await resolveWorkspaceName(workspaceId);
      const message = wsName
        ? `Already saved in \u201c${wsName}\u201d`
        : "Already saved in this workspace";
      showNotification("Already saved", message, "info");
      break;
    }
    case "needs_login":
      // Login notification + tab were issued inside saveOrEnqueue on 401.
      break;
    case "queued":
      // "Saved offline" (or permanent-failure) notifications were issued
      // inside enqueue/drain. Nothing more to do inline.
      break;
    case "error":
      showNotification("Error", outcome.message || "Failed to save", "error");
      break;
  }
}

/** Translation for message-handler callers that expect the SaveResult shape. */
function saveOutcomeToSaveResult(outcome: SaveOutcome): SaveResult {
  switch (outcome.kind) {
    case "ok":
      return { success: true };
    case "queued":
      return { success: true }; // queued means accepted for save; popup treats as success
    case "duplicate":
      return { success: false, duplicate: true };
    case "needs_login":
      return { needsLogin: true };
    case "error":
      return { success: false, error: outcome.message };
  }
}

async function handleXBookmark(url: string): Promise<SaveResult> {
  const workspaceId = await getLastWorkspace();
  console.info(`[Sheltermark] X bookmark captured`, { url, workspaceId });
  try {
    const outcome = await saveOrEnqueue("x_capture", {
      url,
      title: null,
      workspaceId,
    });
    await handleSaveOutcome(outcome, workspaceId);
    return saveOutcomeToSaveResult(outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save";
    console.error(`[Sheltermark] X bookmark failed`, { url, error: message });
    showNotification("Error", message, "error");
    return { success: false, error: message };
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
        console.error(`[Sheltermark] Notification failed`, {
          error: chrome.runtime.lastError.message,
        });
        return;
      }
      setTimeout(() => chrome.notifications.clear(id), NOTIFICATION_DURATION);
    },
  );
}

/** Raw network fetch. Never caches; callers write the cache on success. */
async function fetchWorkspacesRaw(): Promise<GetWorkspacesResult> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/extension/workspaces`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch workspaces");
  return getWorkspacesResultSchema.parse(await response.json());
}

/**
 * Workspaces, cache-first: session cache (~1-3ms) → network → in-memory last
 * resort. Survives MV3 service-worker restarts via chrome.storage.session.
 */
async function getWorkspaces(): Promise<GetWorkspacesResult> {
  if (sessionCache.workspaces) {
    return { workspaces: sessionCache.workspaces };
  }
  const cached = await getCachedWorkspaces();
  if (cached && !(await isCacheStale(cached))) {
    sessionCache.workspaces = cached.value;
    return { workspaces: cached.value };
  }
  const data = await fetchWorkspacesRaw();
  if (data.workspaces) {
    sessionCache.workspaces = data.workspaces;
    void setCachedWorkspaces(data.workspaces);
  }
  return data;
}

/** Raw network fetch for tags. Never caches; callers write the cache. */
async function fetchTagsRaw(): Promise<TagWithCount[]> {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/api/extension/tags`, {
    credentials: "include",
  });
  if (!response.ok) return [];
  return tagsResultSchema.parse(await response.json()).tags ?? [];
}

/**
 * Tag suggestions for the popup typeahead. Cache-first (the session cache
 * outlives the service worker, unlike in-memory state), with a staleness-based
 * revalidation rather than a per-popup refetch.
 */
async function getTags(): Promise<TagWithCount[]> {
  const cached = await getCachedTags();
  if (cached && !(await isCacheStale(cached))) {
    return cached.value;
  }
  const tags = await fetchTagsRaw();
  void setCachedTags(tags);
  return tags;
}

async function getPopupInfo({
  url,
  workspaceId,
}: {
  url: string;
  workspaceId: string | null;
}): Promise<PopupInfo> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams({ url });
  if (workspaceId) params.set("workspace_id", workspaceId);

  const response = await fetch(
    `${baseUrl}/api/extension/popup?${params.toString()}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    return {
      authenticated: false,
      workspaces: [],
      lastWorkspace: null,
      alreadySaved: false,
      bookmarkId: null,
    };
  }
  return popupInfoSchema.parse(await response.json());
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
  return checkResultSchema.parse(await response.json());
}
