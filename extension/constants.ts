export const DEFAULT_BASE_URL = "https://sheltermark.vercel.app";
export const NOTIFICATION_DURATION = 3000;

export const MESSAGE_TYPES = {
  SAVE_BOOKMARK: "SAVE_BOOKMARK",
  GET_TAB_INFO: "GET_TAB_INFO",
  X_BOOKMARK_CAPTURED: "X_BOOKMARK_CAPTURED",
  CHECK_BOOKMARK: "CHECK_BOOKMARK",
  GET_POPUP: "GET_POPUP",
} as const;

type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

interface MessageBase {
  type: MessageType;
}

interface SaveBookmarkMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.SAVE_BOOKMARK;
  data: { url: string; title?: string | null; workspaceId?: string | null };
}

interface GetTabInfoMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.GET_TAB_INFO;
}

interface XBookmarkCapturedMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.X_BOOKMARK_CAPTURED;
  url: string;
}

interface CheckBookmarkMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_BOOKMARK;
  data: { url: string; workspaceId?: string };
}

interface GetPopupMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.GET_POPUP;
  data: { url: string; workspaceId: string | null };
}

export type ExtensionMessage =
  | SaveBookmarkMessage
  | GetTabInfoMessage
  | XBookmarkCapturedMessage
  | CheckBookmarkMessage
  | GetPopupMessage;

// ------------------- Save queue -------------------
//
// The queue persists failed/to-be-attempted saves in chrome.storage.local so they
// survive MV3 service-worker idleness and Chrome restarts. See the offline-save
// audit. The server POST /api/extension/bookmark remains the only author of
// bookmark state; the queue carries intent, not state. Duplicate detection stays
// server-side (409), which the queue treats as a successful terminal outcome.

export type SaveEntrySource = "command" | "contextmenu" | "popup" | "x_capture";

export type QueueItemStatus = "pending" | "in_flight" | "dead";

export type FailureClass =
  | "transient" // network drop, 5xx, 408, 429, fetch TypeError
  | "auth" // 401 — paused until user logs in
  | "permanent" // 4xx other than 401/409/429 — won't succeed on retry
  | "duplicate"; // 409 — server-owned outcome, item removed

export interface QueueItem {
  // Identity / ordering. UUID survives worker restarts; `sequence` is a
  // monotonic int that survives Date.now() clamping in throttled workers.
  id: string;
  enqueuedAt: number;
  sequence: number;

  // The save intent payload — exactly what POST /bookmark expects. `url` is
  // stored raw; the server is the canonical normalizer. `title` is a hint the
  // server may override via metadata. `workspaceId` null means the server
  // resolves the user's default workspace.
  url: string;
  title: string | null;
  workspaceId: string | null;

  // Retry state.
  status: QueueItemStatus;
  attempts: number; // 0 until first POST
  lastAttemptAt: number | null; // ms epoch; null until first attempt
  nextAttemptAt: number | null; // ms epoch due time; null == due immediately

  // Failure capture (bounded).
  failureClass: FailureClass | null;
  lastError: string | null; // capped ~200 chars
  lastStatus: number | null; // HTTP status; null for fetch-level failure

  // Bounded retry history (oldest dropped beyond cap).
  history: { at: number; status: number | null; error: string | null }[];

  // Provenance (diagnostics only; not sent to server).
  source: SaveEntrySource;
}

// Backoff: exponential with jitter, capped. Human-scale base (a flap is usually
// seconds-to-minutes, not ms), capped to avoid retrying forever.
export const QUEUE_BACKOFF_BASE_MS = 30_000; // 30s
export const QUEUE_BACKOFF_MAX_MS = 30 * 60_000; // 30 min
export const QUEUE_MAX_ATTEMPTS = 12; // ~6h wall clock of active retry
export const QUEUE_MAX_HISTORY = 5; // bounded per-item retry log
export const QUEUE_MAX_ERROR_LEN = 200;
export const QUEUE_MAX_ITEMS = 500; // hard cap; evicts oldest pending
export const QUEUE_DEAD_TTL_MS = 7 * 24 * 60 * 60_000; // 7 days

// Notification coalescing window: multiple offline failures within this interval
// produce one "Saved offline — will sync" notification with a count.
export const QUEUE_OFFLINE_NOTICE_DEBOUNCE_MS = 1500;

// Heartbeat alarm. MV3 `periodInMinutes` must be >= 1. Reused as the keep-alive.
export const QUEUE_HEARTBEAT_ALARM = "keepAlive";

export interface SaveResult {
  success?: boolean;
  duplicate?: boolean;
  needsLogin?: boolean;
  error?: string;
}

export interface Workspace {
  id: string;
  name: string;
  is_default?: boolean;
}

export interface TabInfo {
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export interface CheckResult {
  saved?: boolean;
}

export interface PopupInfo {
  authenticated: boolean;
  workspaces?: Workspace[];
  lastWorkspace: string | null;
  alreadySaved: boolean;
  bookmarkId: string | null;
}
