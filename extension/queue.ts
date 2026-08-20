/**
 * Offline save queue for the Sheltermark extension.
 *
 * Background-owned persistence + serial FIFO retry. The server's
 * POST /api/extension/bookmark is the *only* author of bookmark state; this
 * queue carries intent. Duplicate detection stays server-side (the queue
 * treats 409 as a successful terminal outcome).
 *
 * Correctness rests on three invariants:
 *  1. Items are persisted to chrome.storage.local and identified by a stable
 *     UUID + monotonic sequence, so they survive worker restarts.
 *  2. The drain is strictly serial (one POST at a time). This eliminates the
 *     out-of-order / concurrent-insert race against the server's
 *     select-then-insert dedup, defers cleanly to 429 Retry-After, and bounds
 *     wake-up load.
 *  3. On worker restart, any `in_flight` item (worker killed mid-POST) is
 *     reset to `pending` and retried idempotently — safe because the server
 *     dedups, so a duplicate retry POST returns 409 and is removed.
 */

import {
  QUEUE_BACKOFF_BASE_MS,
  QUEUE_BACKOFF_MAX_MS,
  QUEUE_DEAD_TTL_MS,
  QUEUE_HEARTBEAT_ALARM,
  QUEUE_MAX_ATTEMPTS,
  QUEUE_MAX_ERROR_LEN,
  QUEUE_MAX_HISTORY,
  QUEUE_MAX_ITEMS,
  QUEUE_OFFLINE_NOTICE_DEBOUNCE_MS,
  type QueueItem,
  type SaveEntrySource,
} from "./constants.js";
import { queueStorageSchema } from "./schema.js";

const STORAGE_KEYS = {
  ITEMS: "queueItems",
  SEQ: "queueSeq",
  PAUSED: "queuePaused",
  NOTIFIED_OFFLINE_AT: "queueNotifiedOfflineAt",
} as const;

interface QueueState {
  items: QueueItem[];
  seq: number;
  paused: boolean;
  notifiedOfflineAt: number | null;
}

// In-memory only; reset on worker wake via drainOnStartup.

let drainInProgress = false;

// Injected dependencies so background.ts owns chrome.* + fetch + notifications
// and the queue stays pure/testable.

export interface QueueHookContext {
  /**
   * POST one bookmark intent to the server. Returns the raw HTTP outcome so the
   * queue can classify it. The implementation (background.ts) must:
   *   - resolve baseUrl at attempt time
   *   - perform the fetch with credentials: include
   *   - on a network-level failure (fetch rejects with TypeError),
   *     return { fetchThrew: true, errorMessage }
   *   - on an HTTP response, return { status, retryAfterHeader }
   *   - never throw (the queue wraps in safePost anyway, but this keeps the
   *     contract explicit and pure-testable)
   */
  postBookmark: (item: QueueItem) => Promise<PostOutcome>;
  notifyOfflineQueued: (count: number) => void;
  notifySynced: (count: number) => void;
  notifyPermanentFailure: (url: string, reason: string) => void;
  onAuthPaused: () => void; // open login tab + login notification, once
}

export interface PostOutcome {
  fetchThrew: boolean;
  status: number | null; // null when fetchThrew
  errorMessage?: string | null; // fetch-level error string
  retryAfterHeader?: string | null; // for 429
}

type QueueAttemptResult =
  | { kind: "ok" }
  | { kind: "duplicate" }
  | { kind: "auth" }
  | { kind: "transient"; retryAfterMs?: number }
  | { kind: "permanent"; reason: string };

/**
 * Classify an HTTP response or fetch-level failure into a retry decision.
 * Pure function — no I/O. Exported for unit testing.
 */
export function classifyResponse(
  status: number,
  fetchThrew: boolean,
  retryAfterHeader: string | null,
): QueueAttemptResult {
  if (fetchThrew) {
    // fetch rejects only on network-level failure (DNS/TCP/timeout/abort),
    // which is the offline signature. Always transient.
    return { kind: "transient" };
  }
  if (status >= 200 && status < 300) return { kind: "ok" };
  if (status === 409) return { kind: "duplicate" };
  if (status === 401) return { kind: "auth" };
  if (status === 408) return { kind: "transient" };
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(retryAfterHeader);
    return {
      kind: "transient",
      retryAfterMs: retryAfterMs ?? undefined,
    };
  }
  if (status >= 500 && status < 600) return { kind: "transient" };
  // All other 4xx (400, 403, 404, 422, ...) are permanent for this item.
  if (status >= 400 && status < 500) {
    return { kind: "permanent", reason: `HTTP ${status}` };
  }
  // Unknown status range; treat defensively as transient.
  return { kind: "transient" };
}

/** Parse a 429 `Retry-After` header (seconds or HTTP-date) into ms. Exported for
 *  entry points that want to respect a 429 on the *inline* first attempt. */
export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds, 24 * 60 * 60) * 1000;
    }
  }
  // HTTP-date form — best-effort; reject on parse failure (caller falls back
  // to default backoff).
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  const delta = parsed - Date.now();
  return delta > 0 ? Math.min(delta, 24 * 60 * 60_000) : null;
}

/**
 * Backoff delay for attempt `attempt` (1-based: first *failure* yields 1).
 * Exponential with jitter, capped at QUEUE_BACKOFF_MAX_MS.
 * Pure — exported for unit testing.
 */
export function backoffDelayMs(attempt: number): number {
  const exp = Math.min(
    QUEUE_BACKOFF_BASE_MS * 2 ** (attempt - 1),
    QUEUE_BACKOFF_MAX_MS,
  );
  // jitter in [0.5, 1.0)
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exp * jitter);
}

function truncateErr(msg: string): string {
  return msg.length > QUEUE_MAX_ERROR_LEN
    ? `${msg.slice(0, QUEUE_MAX_ERROR_LEN - 1)}\u2026`
    : msg;
}

/**
 * Read the persisted queue state. The schema applies per-field defaults, so a
 * fresh install (absent keys) reads back as an empty queue. A payload that
 * fails to parse (corruption, an older incompatible shape) falls back to the
 * empty state rather than stalling every later drain.
 */
async function readState(): Promise<QueueState> {
  const raw = await chrome.storage.local.get([
    STORAGE_KEYS.ITEMS,
    STORAGE_KEYS.SEQ,
    STORAGE_KEYS.PAUSED,
    STORAGE_KEYS.NOTIFIED_OFFLINE_AT,
  ]);
  const parsed = queueStorageSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[Sheltermark] queue storage unreadable; starting empty", {
      error: parsed.error.message,
    });
    return { items: [], seq: 0, paused: false, notifiedOfflineAt: null };
  }
  return {
    items: parsed.data[STORAGE_KEYS.ITEMS],
    seq: parsed.data[STORAGE_KEYS.SEQ],
    paused: parsed.data[STORAGE_KEYS.PAUSED],
    notifiedOfflineAt: parsed.data[STORAGE_KEYS.NOTIFIED_OFFLINE_AT],
  };
}

async function writeState(state: QueueState): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.ITEMS]: state.items,
    [STORAGE_KEYS.SEQ]: state.seq,
    [STORAGE_KEYS.PAUSED]: state.paused,
    [STORAGE_KEYS.NOTIFIED_OFFLINE_AT]: state.notifiedOfflineAt,
  });
}

interface EnqueueInput {
  url: string;
  title: string | null;
  workspaceId: string | null;
  /**
   * Tag *names* chosen in the popup. Defaults to [] so the fast flows
   * (command, context menu, X capture) keep their exact prior payload.
   */
  tags?: string[];
  source: SaveEntrySource;
  /**
   * Set when the entry point already attempted an inline POST and it failed
   * transiently. Seeds the item as attempt #1 (with backoff applied) so the
   * drain does NOT immediately re-POST the same URL. The next retry fires on
   * the heartbeat after backoffDelayMs(1).
   */
  seedFailedAttempt?: {
    status: number | null;
    errorMessage?: string | null;
    /** Explicit retry delay from the server (429 Retry-After). Wins over backoff. */
    retryAfterMs?: number;
  };
}

/**
 * Persist a save intent. Resolves once the item is durably in storage (the
 * popup may close immediately after this resolves — persistence, not the
 * network request, is now the save guarantee). Never dedups by URL; duplicate
 * detection stays server-side (409).
 */
export async function enqueue(
  input: EnqueueInput,
  hooks: Pick<QueueHookContext, "notifyOfflineQueued">,
): Promise<QueueItem> {
  const state = await readState();

  // Hard cap: evict the oldest non-dead pending item before appending so the
  // queue never grows unbounded. Dead items are retained for surfacing.
  if (state.items.length >= QUEUE_MAX_ITEMS) {
    const evictIdx = state.items.findIndex((i) => i.status === "pending");
    if (evictIdx >= 0) state.items.splice(evictIdx, 1);
  }

  state.seq += 1;
  const now = Date.now();
  const seeded = input.seedFailedAttempt;
  // If the inline attempt failed transiently, apply backoff (or an explicit
  // Retry-After) so the next drain (heartbeat) doesn't re-fire immediately.
  const seededDelayMs = seeded?.retryAfterMs ?? backoffDelayMs(1);
  const item: QueueItem = {
    id: crypto.randomUUID(),
    enqueuedAt: now,
    sequence: state.seq,
    url: input.url,
    title: input.title,
    workspaceId: input.workspaceId,
    tags: input.tags ?? [],
    status: "pending",
    attempts: seeded ? 1 : 0,
    lastAttemptAt: seeded ? now : null,
    nextAttemptAt: seeded ? now + seededDelayMs : null,
    failureClass: seeded ? "transient" : null,
    lastError: seeded
      ? truncateErr(seeded.errorMessage ?? "Transient failure")
      : null,
    lastStatus: seeded ? (seeded?.status ?? null) : null,
    history: seeded
      ? [{ at: now, status: seeded.status, error: seeded.errorMessage ?? null }]
      : [],
    source: input.source,
  };
  state.items.push(item);
  await writeState(state);

  // Coalesce the "Saved offline" notice against the persisted offline flag:
  // notify only if we haven't notified within the debounce window. Using
  // persisted state (not module state) keeps the debounce predictable across
  // worker restarts and across test resets.
  const lastNotice = state.notifiedOfflineAt ?? 0;
  if (now - lastNotice >= QUEUE_OFFLINE_NOTICE_DEBOUNCE_MS) {
    const offlineCount = state.items.filter(
      (i) => i.status === "pending" || i.status === "in_flight",
    ).length;
    hooks.notifyOfflineQueued(offlineCount);
    state.notifiedOfflineAt = now;
    await writeState(state);
  }

  return item;
}

export async function isPaused(): Promise<boolean> {
  const { paused } = await readState();
  return paused;
}

/**
 * Reset every `in_flight` item to `pending` (due immediately) and clear the
 * drain guard. Idempotent retry is safe because the server dedups; a duplicate
 * POST returns 409 and the item is removed. Also sweeps dead items past TTL.
 * Must run once before any `drain()` on worker startup.
 */
export async function drainOnStartup(): Promise<void> {
  drainInProgress = false;
  const state = await readState();
  const now = Date.now();
  let changed = false;

  for (const item of state.items) {
    if (item.status === "in_flight") {
      item.status = "pending";
      item.nextAttemptAt = now; // retry promptly; dedup makes it safe
      changed = true;
    }
  }

  // Sweep dead items past TTL.
  const before = state.items.length;
  state.items = state.items.filter((i) => {
    if (i.status !== "dead") return true;
    const ageRef = i.lastAttemptAt ?? i.enqueuedAt;
    return now - ageRef < QUEUE_DEAD_TTL_MS;
  });
  if (state.items.length !== before) changed = true;

  if (changed) await writeState(state);
}

export async function pauseQueue(): Promise<void> {
  const state = await readState();
  if (state.paused) return;
  state.paused = true;
  await writeState(state);
}

export async function resumeQueue(): Promise<void> {
  const state = await readState();
  let changed = false;
  if (state.paused) {
    state.paused = false;
    changed = true;
  }
  // On resume, bring any due-now items forward so the user sees prompt sync.
  const now = Date.now();
  for (const item of state.items) {
    if (item.status === "pending" && (item.nextAttemptAt ?? 0) < now) {
      item.nextAttemptAt = now;
    }
  }
  if (changed) await writeState(state);
}

/**
 * Process due pending items serially, one POST at a time, until none are due
 * or the queue is paused. Idempotent re-entrancy guard via `drainInProgress`.
 * Heartbeat calls this; alarms/onStartup/resume also call this.
 */
export async function drain(hooks: QueueHookContext): Promise<void> {
  // Claim the guard synchronously before any await so a concurrent drain()
  // call interleaved during readState() cannot slip through.
  if (drainInProgress) return;
  drainInProgress = true;
  try {
    const state = await readState();
    if (state.paused) return;

    let syncedCount = 0;
    const wasOfflineNotified = state.notifiedOfflineAt != null;

    // Loop: re-read only items we mutate, mutating a working copy, writing
    // once per processed item so a mid-drain kill loses at most one item's
    // forward progress (and even that is safe: in_flight → pending on restart).
    const working = state.items.slice();

    for (let i = 0; i < working.length; i++) {
      const item = working[i];
      if (!item || item.status !== "pending") continue;
      if ((item.nextAttemptAt ?? 0) > Date.now()) continue; // not due yet

      // Mark in_flight, persist (crash here → restart recovery resets it).
      item.status = "in_flight";
      await writeState({ ...state, items: working });

      const { result, outcome } = await safePost(hooks, item);
      item.lastAttemptAt = Date.now();
      item.lastStatus = outcome.status;
      item.lastError = null; // set per-branch below

      switch (result.kind) {
        case "ok":
        case "duplicate": {
          appendHistory(item);
          working.splice(i, 1);
          i--; // re-process this index (next item shifted in)
          syncedCount++;
          break;
        }
        case "auth": {
          item.status = "pending";
          item.nextAttemptAt = Date.now(); // due once resumed
          item.failureClass = "auth";
          item.lastStatus = 401;
          item.lastError = "Authentication required";
          appendHistory(item);
          state.paused = true;
          state.notifiedOfflineAt = null;
          await writeState({ ...state, items: working });
          hooks.onAuthPaused();
          return; // stop draining; rest would all 401
        }
        case "transient": {
          item.attempts += 1;
          item.failureClass = "transient";
          item.lastError = outcome.fetchThrew
            ? truncateErr(outcome.errorMessage ?? "Network error")
            : "Transient failure";
          if (item.attempts >= QUEUE_MAX_ATTEMPTS) {
            item.status = "dead";
            item.failureClass = "permanent";
            item.lastError = `Max retries (${QUEUE_MAX_ATTEMPTS}) reached`;
          } else {
            const base = result.retryAfterMs ?? backoffDelayMs(item.attempts);
            item.status = "pending";
            item.nextAttemptAt = Date.now() + base;
          }
          appendHistory(item);
          // 429 Retry-After should defer the whole queue (server is asking the
          // tenant to slow down globally), so bump every other pending item too.
          if (result.retryAfterMs != null) {
            for (const other of working) {
              if (other === item) continue;
              if (other.status === "pending") {
                other.nextAttemptAt = Math.max(
                  other.nextAttemptAt ?? 0,
                  Date.now() + result.retryAfterMs,
                );
              }
            }
          }
          break;
        }
        case "permanent": {
          item.status = "dead";
          item.attempts += 1;
          item.failureClass = "permanent";
          item.lastError = truncateErr(
            outcome.fetchThrew
              ? (outcome.errorMessage ?? "Network error")
              : (result.reason ?? "Permanent failure"),
          );
          appendHistory(item);
          await writeState({ ...state, items: working });
          hooks.notifyPermanentFailure(
            item.url,
            item.lastError ?? "Permanent failure",
          );
          // Dead items stay in working[] (kept for surfacing + TTL).
          continue;
        }
      }

      await writeState({ ...state, items: working });
    }

    // Coalesced sync notification: only when we drained into an empty
    // (pending/in_flight) queue AND the user was previously told they were
    // offline. Retries that still leave items queued stay silent.
    const remaining = working.filter(
      (i) => i.status === "pending" || i.status === "in_flight",
    ).length;
    const fullyDrained = remaining === 0;
    if (syncedCount > 0 && wasOfflineNotified && fullyDrained) {
      state.items = working;
      state.notifiedOfflineAt = null;
      await writeState(state);
      hooks.notifySynced(syncedCount);
    } else {
      state.items = working;
      if (state.notifiedOfflineAt != null && fullyDrained) {
        state.notifiedOfflineAt = null;
      }
      await writeState(state);
    }
  } finally {
    drainInProgress = false;
  }
}

async function safePost(
  hooks: QueueHookContext,
  item: QueueItem,
): Promise<{ result: QueueAttemptResult; outcome: PostOutcome }> {
  let outcome: PostOutcome;
  try {
    outcome = await hooks.postBookmark(item);
  } catch (err) {
    outcome = {
      fetchThrew: true,
      status: null,
      errorMessage: err instanceof Error ? err.message : "Network error",
    };
  }
  const result = classifyResponse(
    outcome.status ?? 0,
    outcome.fetchThrew,
    outcome.retryAfterHeader ?? null,
  );
  return { result, outcome };
}

function appendHistory(item: QueueItem): void {
  item.history.push({
    at: Date.now(),
    status: item.lastStatus,
    error: item.lastError,
  });
  if (item.history.length > QUEUE_MAX_HISTORY) {
    item.history.splice(0, item.history.length - QUEUE_MAX_HISTORY);
  }
}

/**
 * Register the heartbeat alarm. Idempotent: recreates the alarm. The keep-alive
 * behavior falls out for free — `drain()` touches chrome.storage.local, which
 * keeps the worker active. Reuse the existing `keepAlive` name so any other
 * code referencing it keeps working.
 */
export function installHeartbeat(): void {
  chrome.alarms.create(QUEUE_HEARTBEAT_ALARM, { periodInMinutes: 1 });
}

export function isHeartbeatAlarm(alarmName: string): boolean {
  return alarmName === QUEUE_HEARTBEAT_ALARM;
}
