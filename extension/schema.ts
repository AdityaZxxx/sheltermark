/**
 * Boundary schemas for the extension. Types are inferred from these so the
 * runtime contract and static types cannot drift.
 *
 * These mirror the server's /api/extension/* route contracts and are
 * duplicated here (not imported from lib/) because the extension is a
 * separately bundled artifact.
 */
import { z } from "zod";

import { MESSAGE_TYPES } from "./constants.js";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_default: z.boolean().optional(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const tagWithCountSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number(),
});
export type TagWithCount = z.infer<typeof tagWithCountSchema>;

export const getWorkspacesResultSchema = z.object({
  workspaces: z.array(workspaceSchema).optional(),
  error: z.string().optional(),
});
export type GetWorkspacesResult = z.infer<typeof getWorkspacesResultSchema>;

export const tagsResultSchema = z.object({
  authenticated: z.boolean(),
  tags: z.array(tagWithCountSchema).optional(),
});
export type TagsResult = z.infer<typeof tagsResultSchema>;

// alreadySaved/bookmarkId default because the unauthenticated popup response
// omits them.
export const popupInfoSchema = z.object({
  authenticated: z.boolean(),
  workspaces: z.array(workspaceSchema).optional(),
  lastWorkspace: z.string().nullable(),
  alreadySaved: z.boolean().default(false),
  bookmarkId: z.string().nullable().default(null),
});
export type PopupInfo = z.infer<typeof popupInfoSchema>;

export const checkResultSchema = z.object({
  saved: z.boolean().optional(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const saveResultSchema = z.object({
  success: z.boolean().optional(),
  duplicate: z.boolean().optional(),
  needsLogin: z.boolean().optional(),
  error: z.string().optional(),
});
export type SaveResult = z.infer<typeof saveResultSchema>;

export const tabInfoSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  favIconUrl: z.string().optional(),
});
export type TabInfo = z.infer<typeof tabInfoSchema>;

// --- chrome.storage contracts (chrome.storage hands back untyped JSON even
// when this extension is the sole writer) ---

/**
 * The queue persists failed/to-be-attempted saves in chrome.storage.local so
 * they survive MV3 service-worker idleness and Chrome restarts. The server
 * POST /api/extension/bookmark is the only author of bookmark state; the
 * queue carries intent. Duplicate detection stays server-side (409), which
 * the queue treats as a successful terminal outcome.
 */

const queueHistoryEntrySchema = z.object({
  at: z.number(),
  status: z.number().nullable(),
  error: z.string().nullable(),
});

/**
 * The save intent payload — exactly what POST /bookmark expects. `url` is
 * stored raw; the server is the canonical normalizer. `title` is a hint the
 * server may override via metadata unless the user explicitly set it.
 * `workspaceId` null means the server resolves the user's default workspace.
 * `tags` are tag *names* (not ids) so a queued item is self-contained offline
 * — names resolve against current tag state at apply time.
 */
export const queueItemSchema = z.object({
  id: z.string(),
  enqueuedAt: z.number(), // ms epoch
  sequence: z.number(), // monotonic; survives Date.now() clamping in throttled workers
  url: z.string(),
  title: z.string().nullable(),
  workspaceId: z.string().nullable(),
  // Backfills items persisted by an older build: `tags` did not exist before
  // quick metadata editing, and a missing value must behave like an empty
  // selection.
  tags: z.array(z.string()).default([]),
  status: z.enum(["pending", "in_flight", "dead"]),
  attempts: z.number(), // 0 until first POST
  lastAttemptAt: z.number().nullable(), // ms epoch; null until first attempt
  nextAttemptAt: z.number().nullable(), // ms epoch due time; null == due now
  failureClass: z
    .enum([
      "transient", // network drop, 5xx, 408, 429, fetch TypeError
      "auth", // 401 — paused until user logs in
      "permanent", // 4xx other than 401/409/429 — won't succeed on retry
      "duplicate", // 409 — server-owned outcome, item removed
    ])
    .nullable(),
  lastError: z.string().nullable(), // capped ~200 chars
  lastStatus: z.number().nullable(), // HTTP status; null for fetch-level failure
  // Bounded retry history (oldest dropped beyond cap).
  history: z.array(queueHistoryEntrySchema),
  source: z.enum(["command", "contextmenu", "popup", "x_capture"]),
});
export type QueueItem = z.infer<typeof queueItemSchema>;
export type SaveEntrySource = QueueItem["source"];

// Per-field defaults make absent keys read back as the empty state (fresh
// install / never-initialized storage).
export const queueStorageSchema = z.object({
  queueItems: z.array(queueItemSchema).default([]),
  queueSeq: z.number().default(0),
  queuePaused: z.boolean().default(false),
  queueNotifiedOfflineAt: z.number().nullable().default(null),
});

export const baseUrlStorageSchema = z.object({
  baseUrl: z.string(),
});

export const lastWorkspaceStorageSchema = z.object({
  lastWorkspace: z.object({ id: z.string(), baseUrl: z.string() }),
});

const cachedEntrySchema = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    updatedAt: z.number(),
    baseUrl: z.string(),
  });

export const cachedWorkspacesSchema = z.object({
  cachedWorkspaces: cachedEntrySchema(z.array(workspaceSchema)),
});

export const cachedTagsSchema = z.object({
  cachedTags: cachedEntrySchema(z.array(tagWithCountSchema)),
});

export const extensionMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(MESSAGE_TYPES.SAVE_BOOKMARK),
    data: z.object({
      url: z.string(),
      title: z.string().nullish(),
      workspaceId: z.string().nullish(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    type: z.literal(MESSAGE_TYPES.GET_TAB_INFO),
  }),
  z.object({
    type: z.literal(MESSAGE_TYPES.X_BOOKMARK_CAPTURED),
    url: z.string(),
  }),
  z.object({
    type: z.literal(MESSAGE_TYPES.CHECK_BOOKMARK),
    data: z.object({
      url: z.string(),
      workspaceId: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal(MESSAGE_TYPES.GET_POPUP),
    data: z.object({
      url: z.string(),
      workspaceId: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal(MESSAGE_TYPES.GET_TAGS),
  }),
  z.object({
    type: z.literal(MESSAGE_TYPES.AUTH_MAYBE_RESTORED),
  }),
]);
export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;
