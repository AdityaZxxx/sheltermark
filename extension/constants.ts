export const DEFAULT_BASE_URL = "https://sheltermark.vercel.app";
export const NOTIFICATION_DURATION = 3000;

export const MESSAGE_TYPES = {
  SAVE_BOOKMARK: "SAVE_BOOKMARK",
  GET_TAB_INFO: "GET_TAB_INFO",
  X_BOOKMARK_CAPTURED: "X_BOOKMARK_CAPTURED",
  CHECK_BOOKMARK: "CHECK_BOOKMARK",
  GET_POPUP: "GET_POPUP",
  GET_TAGS: "GET_TAGS",
} as const;

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

// All shape contracts live in schema.ts; the types below are the parsed forms
// of those schemas so callers keep importing them from here.
export type {
  CheckResult,
  ExtensionMessage,
  GetWorkspacesResult,
  PopupInfo,
  QueueItem,
  SaveEntrySource,
  SaveResult,
  TabInfo,
  TagsResult,
  TagWithCount,
  Workspace,
} from "./schema.js";
