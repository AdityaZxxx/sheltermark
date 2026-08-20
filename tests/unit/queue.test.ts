/// <reference types="chrome" />
/**
 * Unit tests for extension/queue.ts — offline save queue.
 *
 * Bun provides crypto.randomUUID natively. We mock only the chrome.* surface the queue
 * actually uses:
 *   - chrome.storage.local.get / .set  (in-memory Map)
 *   - chrome.alarms.create             (records calls; never fires automatically)
 *
 * postBookmark is injected via QueueHookContext, so there is no real network.
 * Date.now is left real except where a test explicitly stubs it.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
  type Mock,
} from "bun:test";

import {
  QUEUE_MAX_ATTEMPTS,
  QUEUE_MAX_HISTORY,
  QUEUE_MAX_ITEMS,
  type QueueItem,
} from "~/extension/constants.js";
import {
  backoffDelayMs,
  classifyResponse,
  drain,
  drainOnStartup,
  enqueue,
  installHeartbeat,
  isPaused,
  type PostOutcome,
  pauseQueue,
  type QueueHookContext,
  resumeQueue,
} from "~/extension/queue.js";

/** The exact chrome.storage.local payload queue.ts owns. */
interface Store {
  queueItems?: QueueItem[];
  queueSeq?: number;
  queuePaused?: boolean;
  queueNotifiedOfflineAt?: number | null;
}

function pickStored(keys: string[], store: Store): Partial<Store> {
  const out: Partial<Store> = {};
  for (const key of keys) {
    switch (key) {
      case "queueItems":
        if (store.queueItems !== undefined) out.queueItems = store.queueItems;
        break;
      case "queueSeq":
        if (store.queueSeq !== undefined) out.queueSeq = store.queueSeq;
        break;
      case "queuePaused":
        if (store.queuePaused !== undefined)
          out.queuePaused = store.queuePaused;
        break;
      case "queueNotifiedOfflineAt":
        out.queueNotifiedOfflineAt = store.queueNotifiedOfflineAt ?? null;
        break;
      default:
        break;
    }
  }
  return out;
}

function clearStore(store: Store): void {
  delete store.queueItems;
  delete store.queueSeq;
  delete store.queuePaused;
  delete store.queueNotifiedOfflineAt;
}

function makeChromeMock(initial: Store = {}) {
  const store: Store = { ...initial };
  const createdAlarms: { name: string; periodInMinutes?: number }[] = [];

  const chrome = {
    storage: {
      local: {
        get: mock(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return pickStored(list, store);
        }),
        set: mock(async (items: Partial<Store>) => {
          Object.assign(store, items);
        }),
      },
    },
    alarms: {
      create: mock((name: string, opts?: { periodInMinutes?: number }) => {
        createdAlarms.push({ name, periodInMinutes: opts?.periodInMinutes });
      }),
    },
  };

  return { chrome, store, createdAlarms };
}

function seedQueue(items: QueueItem[], seq?: number): Store {
  const maxSeq = items.reduce((m, i) => Math.max(m, i.sequence), 0);
  return {
    queueItems: items,
    queueSeq: seq ?? maxSeq,
    queuePaused: false,
    queueNotifiedOfflineAt: null,
  };
}

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    enqueuedAt: Date.now(),
    sequence: 1,
    url: "https://example.com/post",
    title: "Test",
    workspaceId: null,
    tags: [],
    status: "pending",
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    failureClass: null,
    lastError: null,
    lastStatus: null,
    history: [],
    source: "command",
    ...overrides,
  };
}

interface HookHarness {
  ctx: QueueHookContext;
  spies: {
    notifyOfflineQueued: Mock<QueueHookContext["notifyOfflineQueued"]>;
    notifySynced: Mock<QueueHookContext["notifySynced"]>;
    notifyPermanentFailure: Mock<QueueHookContext["notifyPermanentFailure"]>;
    onAuthPaused: Mock<QueueHookContext["onAuthPaused"]>;
  };
}

function hooks(
  postBookmark: (item: QueueItem) => Promise<PostOutcome>,
  overrides: Partial<
    Pick<
      QueueHookContext,
      | "notifyOfflineQueued"
      | "notifySynced"
      | "notifyPermanentFailure"
      | "onAuthPaused"
    >
  > = {},
): HookHarness {
  const notifyOfflineQueued = overrides.notifyOfflineQueued
    ? mock(overrides.notifyOfflineQueued)
    : mock();
  const notifySynced = overrides.notifySynced
    ? mock(overrides.notifySynced)
    : mock();
  const notifyPermanentFailure = overrides.notifyPermanentFailure
    ? mock(overrides.notifyPermanentFailure)
    : mock();
  const onAuthPaused = overrides.onAuthPaused
    ? mock(overrides.onAuthPaused)
    : mock();
  const ctx: QueueHookContext = {
    postBookmark,
    notifyOfflineQueued,
    notifySynced,
    notifyPermanentFailure,
    onAuthPaused,
  };
  return {
    ctx,
    spies: {
      notifyOfflineQueued,
      notifySynced,
      notifyPermanentFailure,
      onAuthPaused,
    },
  };
}

const okOutcome: PostOutcome = { fetchThrew: false, status: 200 };
const dupOutcome: PostOutcome = { fetchThrew: false, status: 409 };
const authOutcome: PostOutcome = { fetchThrew: false, status: 401 };
const throwOutcome: PostOutcome = {
  fetchThrew: true,
  status: null,
  errorMessage: "Failed to fetch",
};

// Hook the global chrome before importing queue.js. Because queue.ts imports
// chrome lazily (references the global at call time inside async fns), we can
// assign it after import as long as it's set before any function call.
const chromeMock = makeChromeMock();
// SAFETY: in a browser extension `chrome` is the extension global; the test
// installs a lookalike here so the (unmocked) queue modules use it.
// @ts-expect-error - installs a chrome.* lookalike over the browser-extension global types so unmocked queue code uses it.
globalThis.chrome = chromeMock.chrome;

beforeEach(() => {
  clearStore(chromeMock.store);
  chromeMock.createdAlarms.length = 0;
  chromeMock.chrome.storage.local.get.mockClear();
  chromeMock.chrome.storage.local.set.mockClear();
});

afterEach(() => {
  // Bun's jest.restoreAllMocks only restores spies; mock() instances are
  // cleared per test by the beforeEach clearStore + mockClear calls above.
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("classifyResponse", () => {
  it("2xx → ok", () => {
    expect(classifyResponse(200, false, null)).toEqual({ kind: "ok" });
    expect(classifyResponse(201, false, null)).toEqual({ kind: "ok" });
    expect(classifyResponse(299, false, null)).toEqual({ kind: "ok" });
  });

  it("409 → duplicate (success-equivalent terminal)", () => {
    expect(classifyResponse(409, false, null)).toEqual({ kind: "duplicate" });
  });

  it("401 → auth (paused, not permanent)", () => {
    expect(classifyResponse(401, false, null)).toEqual({ kind: "auth" });
  });

  it("408 → transient", () => {
    expect(classifyResponse(408, false, null)).toEqual({ kind: "transient" });
  });

  it("429 → transient, honors Retry-After seconds", () => {
    expect(classifyResponse(429, false, "30")).toEqual({
      kind: "transient",
      retryAfterMs: 30_000,
    });
  });

  it("429 with no Retry-After header → transient without override", () => {
    expect(classifyResponse(429, false, null)).toEqual({ kind: "transient" });
  });

  it("429 with HTTP-date Retry-After → transient with ms delta", () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    expect(classifyResponse(429, false, future)).toEqual({
      kind: "transient",
      retryAfterMs: expect.any(Number),
    });
  });

  it("5xx → transient", () => {
    expect(classifyResponse(500, false, null)).toEqual({ kind: "transient" });
    expect(classifyResponse(502, false, null)).toEqual({ kind: "transient" });
    expect(classifyResponse(503, false, null)).toEqual({ kind: "transient" });
  });

  it("fetch-level failure (TypeError) → transient", () => {
    expect(classifyResponse(0, true, null)).toEqual({ kind: "transient" });
  });

  it("400 → permanent", () => {
    expect(classifyResponse(400, false, null)).toEqual({
      kind: "permanent",
      reason: "HTTP 400",
    });
  });

  it("422 → permanent", () => {
    expect(classifyResponse(422, false, null)).toEqual({
      kind: "permanent",
      reason: "HTTP 422",
    });
  });

  it("403 → permanent (not retried)", () => {
    expect(classifyResponse(403, false, null)).toEqual({
      kind: "permanent",
      reason: "HTTP 403",
    });
  });
});

describe("backoffDelayMs", () => {
  it("attempt 1 ≈ 30s (jitter ±50%)", () => {
    for (let i = 0; i < 20; i++) {
      const d = backoffDelayMs(1);
      expect(d).toBeGreaterThanOrEqual(15_000);
      expect(d).toBeLessThanOrEqual(30_000);
    }
  });

  it("attempt 2 ≈ 60s, attempt 3 ≈ 120s (exponential growth)", () => {
    for (let i = 0; i < 10; i++) {
      expect(backoffDelayMs(2)).toBeGreaterThanOrEqual(30_000);
      expect(backoffDelayMs(2)).toBeLessThanOrEqual(60_000);
      expect(backoffDelayMs(3)).toBeGreaterThanOrEqual(60_000);
      expect(backoffDelayMs(3)).toBeLessThanOrEqual(120_000);
    }
  });

  it("caps at 30 minutes for huge attempt counts", () => {
    for (let i = 0; i < 20; i++) {
      expect(backoffDelayMs(50)).toBeLessThanOrEqual(30 * 60_000);
      expect(backoffDelayMs(50)).toBeGreaterThanOrEqual(15 * 60_000);
    }
  });
});

describe("enqueue", () => {
  it("assigns a stable UUID id and a monotonically increasing sequence", async () => {
    rafChrome({
      queueItems: [],
      queueSeq: 0,
      queuePaused: false,
      queueNotifiedOfflineAt: null,
    });

    const a = await enqueue(
      {
        url: "https://a.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: () => undefined },
    );
    const b = await enqueue(
      {
        url: "https://b.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: () => undefined },
    );

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(b.sequence).toBe(a.sequence + 1);
  });

  it("does not dedup by URL (server owns dedup)", async () => {
    await enqueue(
      {
        url: "https://same.test/x",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: () => undefined },
    );
    await enqueue(
      {
        url: "https://same.test/x",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: () => undefined },
    );
    expect(chromeMock.store.queueItems?.length).toBe(2);
  });

  it("coalesces the offline notification within the debounce window", async () => {
    const notice = mock();
    await enqueue(
      {
        url: "https://a.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: notice },
    );
    await enqueue(
      {
        url: "https://b.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: notice },
    );
    await enqueue(
      {
        url: "https://c.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: notice },
    );
    expect(notice).toHaveBeenCalledTimes(1);
    expect(notice).toHaveBeenCalledWith(1); // count at time of first notice
  });

  it("evicts the oldest pending item when the queue exceeds the hard cap", async () => {
    // Pre-fill to the cap.
    const items = Array.from({ length: QUEUE_MAX_ITEMS }, (_, i) =>
      makeItem({ sequence: i + 1, url: `https://ex.test/${i}` }),
    );
    rafChrome(seedQueue(items));

    const newest = await enqueue(
      {
        url: "https://new.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: () => undefined },
    );

    const stored = chromeMock.store.queueItems ?? [];
    expect(stored.length).toBe(QUEUE_MAX_ITEMS); // capped, not growing
    // Oldest (seq=1) was evicted.
    expect(stored.find((i) => i.sequence === 1)).toBeUndefined();
    expect(stored.find((i) => i.id === newest.id)).toBeDefined();
  });

  it("persists tags in the queued item so offline items carry the intent", async () => {
    const item = await enqueue(
      {
        url: "https://t.test",
        title: "An Article",
        workspaceId: "ws-1",
        tags: ["reading", "dev"],
        source: "popup",
      },
      { notifyOfflineQueued: () => undefined },
    );

    expect(item.tags).toEqual(["reading", "dev"]);
    const stored = chromeMock.store.queueItems ?? [];
    expect(stored[0]?.tags).toEqual(["reading", "dev"]);
  });

  it("defaults tags to [] when omitted (fast flows)", async () => {
    const item = await enqueue(
      {
        url: "https://t.test",
        title: null,
        workspaceId: null,
        source: "command",
      },
      { notifyOfflineQueued: () => undefined },
    );

    expect(item.tags).toEqual([]);
  });
});

describe("drain", () => {
  it("is a no-op when the queue is empty or paused", async () => {
    const callCount = { n: 0 };
    const postCount = mock(async () => {
      callCount.n++;
      return okOutcome;
    });

    await drain(hooks(postCount).ctx);
    expect(postCount).not.toHaveBeenCalled();

    rafChrome({ ...seedQueue([makeItem()]), queuePaused: true });
    await pauseQueue();
    await drain(hooks(postCount).ctx);
    expect(postCount).not.toHaveBeenCalled();
  });

  it("processes pending items via POST and removes them on 200", async () => {
    const posted: string[] = [];
    rafChrome(seedQueue([makeItem({ sequence: 1, url: "https://one.test" })]));

    const { ctx } = hooks(async (item) => {
      posted.push(item.id);
      return okOutcome;
    });
    await drain(ctx);

    expect(chromeMock.store.queueItems ?? []).toHaveLength(0);
    expect(posted).toHaveLength(1);
  });

  it("passes queued tags through to the postBookmark hook", async () => {
    const received: { url: string; tags: string[] | undefined }[] = [];
    rafChrome(
      seedQueue([
        makeItem({
          sequence: 1,
          url: "https://one.test",
          tags: ["reading", "dev"],
        }),
        makeItem({
          sequence: 2,
          url: "https://two.test",
          tags: [],
        }),
      ]),
    );

    await drain(
      hooks(async (item) => {
        received.push({ url: item.url, tags: item.tags });
        return okOutcome;
      }).ctx,
    );

    expect(received).toEqual([
      { url: "https://one.test", tags: ["reading", "dev"] },
      { url: "https://two.test", tags: [] },
    ]);
  });

  it("backfills tags=[] for items persisted by an older build", async () => {
    const oldItem = makeItem({ sequence: 1, url: "https://legacy.test" });
    // Seed an item that pre-dates the tags field; this is the exact payload a
    // previous build would have written.
    // SAFETY: QueueItem.tags is always defined at runtime here, but the legacy
    // scenario under test is a stored payload that lacks the field entirely;
    // erasing it reproduces that payload faithfully.
    (oldItem as { tags?: string[] }).tags = undefined;
    rafChrome(seedQueue([oldItem]));

    const receivedTags: (string[] | undefined)[] = [];
    await drain(
      hooks(async (item) => {
        receivedTags.push(item.tags);
        return okOutcome;
      }).ctx,
    );

    expect(receivedTags).toHaveLength(1);
    expect(receivedTags[0]).toEqual([]);
  });

  it("respects FIFO (sequence) ordering", async () => {
    const order: string[] = [];
    rafChrome(
      seedQueue([
        makeItem({ sequence: 1, url: "https://first.test" }),
        makeItem({ sequence: 2, url: "https://second.test" }),
        makeItem({ sequence: 3, url: "https://third.test" }),
      ]),
    );

    await drain(
      hooks(async (item) => {
        order.push(item.url);
        return okOutcome;
      }).ctx,
    );

    expect(order).toEqual([
      "https://first.test",
      "https://second.test",
      "https://third.test",
    ]);
  });

  it("processes strictly one item at a time (no parallel POSTs)", async () => {
    const concurrent = { current: 0, max: 0 };
    rafChrome(
      seedQueue([
        makeItem({ sequence: 1, url: "https://a.test" }),
        makeItem({ sequence: 2, url: "https://b.test" }),
        makeItem({ sequence: 3, url: "https://c.test" }),
      ]),
    );

    await drain(
      hooks(async () => {
        concurrent.current++;
        concurrent.max = Math.max(concurrent.max, concurrent.current);
        // Yield to microtask queue to reveal any parallel start.
        await new Promise((r) => setTimeout(r, 10));
        concurrent.current--;
        return okOutcome;
      }).ctx,
    );

    expect(concurrent.max).toBe(1);
  });

  it("skips items not yet due but retains them", async () => {
    const now = Date.now();
    const futureItem = makeItem({
      sequence: 1,
      url: "https://future.test",
      nextAttemptAt: now + 60_000, // 1 min in the future
    });
    rafChrome(seedQueue([futureItem]));
    await drain(
      hooks(async () => Promise.reject(new Error("should not post"))).ctx,
    );
    expect(chromeMock.store.queueItems ?? []).toHaveLength(1); // still queued
  });

  it("removes a duplicate (409) item as success-equivalent, keeps going", async () => {
    const order: string[] = [];
    rafChrome(
      seedQueue([
        makeItem({ sequence: 1, url: "https://dup.test" }),
        makeItem({ sequence: 2, url: "https://next.test" }),
      ]),
    );
    await drain(
      hooks(async (item) => {
        order.push(item.url);
        return item.url === "https://dup.test" ? dupOutcome : okOutcome;
      }).ctx,
    );
    expect(chromeMock.store.queueItems ?? []).toHaveLength(0);
    expect(order).toEqual(["https://dup.test", "https://next.test"]);
  });

  it("pauses the queue and triggers the login flow on 401", async () => {
    const { ctx, spies } = hooks(
      async () => authOutcome, // all 401
    );
    rafChrome(seedQueue([makeItem(), makeItem({ sequence: 2 })]));

    await drain(ctx);

    expect(spies.onAuthPaused).toHaveBeenCalledTimes(1);
    expect(chromeMock.store.queuePaused).toBe(true);
    // Both items should remain pending (queue paused before the second POST).
    expect(chromeMock.store.queueItems ?? []).toHaveLength(2);
    expect(
      chromeMock.store.queueItems?.every((i) => i.status === "pending"),
    ).toBe(true);
  });

  it("resumes the queue after authentication: resumeQueue clears flag and drains", async () => {
    let postAttempts = 0;
    const { ctx, spies } = hooks(async () => {
      postAttempts++;
      // First attempt 401s; subsequent attempts succeed (user logged in).
      return postAttempts === 1 ? authOutcome : okOutcome;
    });

    rafChrome(seedQueue([makeItem({ sequence: 1 })]));

    await drain(ctx);
    expect(chromeMock.store.queuePaused).toBe(true);
    expect(spies.onAuthPaused).toHaveBeenCalledTimes(1);

    // Resume simulates successful login.
    await resumeQueue();
    expect(chromeMock.store.queuePaused).toBe(false);

    await drain(ctx);
    expect(chromeMock.store.queueItems ?? []).toHaveLength(0);
  });

  it("backs off a transient failure with a future nextAttemptAt and keeps the item", async () => {
    rafChrome(seedQueue([makeItem({ sequence: 1 })]));

    // Use fake timers so we can assert on the computed delay without waiting.
    jest.useFakeTimers();
    jest.setSystemTime(Date.now());

    await drain(hooks(async () => throwOutcome).ctx);

    const [item] = chromeMock.store.queueItems ?? [];
    expect(item?.status).toBe("pending");
    expect(item?.attempts).toBe(1);
    expect(item?.failureClass).toBe("transient");
    expect(item?.nextAttemptAt).toBeGreaterThan(Date.now());
    // Delay is at least ~15s (backoff jitter lower bound) in the future.
    expect((item?.nextAttemptAt ?? 0) - Date.now()).toBeGreaterThan(10_000);
  });

  it("429 Retry-After defers both the failing item and other pending items", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.now());

    const future = new Date(Date.now() + 5 * 60_000).toUTCString();

    rafChrome(
      seedQueue([
        makeItem({ sequence: 1, url: "https://one.test" }),
        makeItem({ sequence: 2, url: "https://two.test" }),
      ]),
    );

    await drain(
      hooks(async (item) =>
        item.url === "https://one.test"
          ? { fetchThrew: false, status: 429, retryAfterHeader: future }
          : okOutcome,
      ).ctx,
    );

    const [i1, i2] = chromeMock.store.queueItems ?? [];
    // Both items should be pending with nextAttemptAt ~ 5 minutes out.
    expect(i1?.status).toBe("pending");
    expect(i2?.status).toBe("pending");
    const minDelay = 4 * 60_000; // allow jitter; at least ~4 minutes
    expect((i1?.nextAttemptAt ?? 0) - Date.now()).toBeGreaterThanOrEqual(
      minDelay,
    );
    expect((i2?.nextAttemptAt ?? 0) - Date.now()).toBeGreaterThanOrEqual(
      minDelay,
    );
  });

  it("kills a transient item after MAX_ATTEMPTS (dead, no more retry)", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.now());
    rafChrome(
      seedQueue([
        makeItem({
          sequence: 1,
          attempts: QUEUE_MAX_ATTEMPTS - 1, // one failure away from cap
        }),
      ]),
    );
    await drain(hooks(async () => throwOutcome).ctx);
    const [item] = chromeMock.store.queueItems ?? [];
    expect(item?.status).toBe("dead");
    expect(item?.failureClass).toBe("permanent");
  });

  it("marks a permanent 4xx as dead, notifies once, removes from active flow", async () => {
    const { ctx, spies } = hooks(async () => ({
      fetchThrew: false,
      status: 422,
    }));
    rafChrome(seedQueue([makeItem({ sequence: 1, url: "https://bad.test" })]));

    await drain(ctx);

    const [item] = chromeMock.store.queueItems ?? [];
    expect(item?.status).toBe("dead");
    expect(item?.failureClass).toBe("permanent");
    expect(spies.notifyPermanentFailure).toHaveBeenCalledTimes(1);
    expect(spies.notifyPermanentFailure).toHaveBeenCalledWith(
      "https://bad.test",
      expect.stringContaining("422"),
    );
    // Dead items are retained (for surfacing + TTL cleanup), not removed here.
    expect(chromeMock.store.queueItems ?? []).toHaveLength(1);
  });

  it("syncs an offline queue and fires exactly one coalesced sync notification", async () => {
    // First, establish that an offline notice was issued (simulating the
    // offline-enter path that sets queueNotifiedOfflineAt).
    rafChrome({
      ...seedQueue([
        makeItem({ sequence: 1 }),
        makeItem({ sequence: 2 }),
        makeItem({ sequence: 3 }),
      ]),
      queueNotifiedOfflineAt: Date.now(),
    });
    const { ctx, spies } = hooks(async () => okOutcome);
    await drain(ctx);

    expect(spies.notifySynced).toHaveBeenCalledTimes(1);
    expect(spies.notifySynced).toHaveBeenCalledWith(3);
    expect(chromeMock.store.queueNotifiedOfflineAt).toBeNull();
  });

  it("does not fire sync notification when the queue was never the user's offline moment", async () => {
    rafChrome({
      ...seedQueue([makeItem({ sequence: 1 })]),
      queueNotifiedOfflineAt: null, // never notified offline
    });
    const { ctx, spies } = hooks(async () => okOutcome);
    await drain(ctx);
    expect(spies.notifySynced).not.toHaveBeenCalled();
  });

  it("is non-reentrant: a concurrent drain() while one runs is a no-op", async () => {
    let calls = 0;
    // SAFETY: the Promise executor runs synchronously and assigns before any
    // await, so resolveGate is definitely assigned by the time it's called.
    let resolveGate!: () => void;
    const gate = new Promise<void>((r) => {
      resolveGate = r;
    });

    const { ctx } = hooks(async () => {
      calls++;
      await gate; // hold the first POST so a second drain attempt must be refused
      return okOutcome;
    });

    rafChrome(seedQueue([makeItem({ sequence: 1 })]));

    const d1 = drain(ctx);
    // Immediately attempt another drain while the first is mid-flight.
    const d2 = drain(ctx);
    resolveGate();
    await Promise.all([d1, d2]);

    // Exactly one POST: the second drain was rejected as concurrent.
    expect(calls).toBe(1);
  });
});

describe("drainOnStartup", () => {
  it("resets in_flight items back to pending (idempotent retry)", async () => {
    rafChrome(
      seedQueue([
        makeItem({ sequence: 1, status: "in_flight" }),
        makeItem({ sequence: 2, status: "pending" }),
      ]),
    );
    await drainOnStartup();
    const items = chromeMock.store.queueItems ?? [];
    expect(items.every((i) => i.status === "pending")).toBe(true);
    // The reset item should be due immediately so the serial pump picks it up.
    expect(items.every((i) => (i.nextAttemptAt ?? 0) <= Date.now())).toBe(true);
  });

  it("sweeps dead items past TTL", async () => {
    const now = Date.now();
    rafChrome(
      seedQueue([
        makeItem({
          sequence: 1,
          status: "dead",
          lastAttemptAt: now - 8 * 24 * 60 * 60_000, // 8 days → past 7d TTL
        }),
        makeItem({
          sequence: 2,
          status: "dead",
          lastAttemptAt: now - 6 * 24 * 60 * 60_000, // within TTL, kept
        }),
        makeItem({ sequence: 3, status: "pending" }),
      ]),
    );
    await drainOnStartup();
    const items = chromeMock.store.queueItems ?? [];
    expect(items).toHaveLength(2); // old dead swept; fresh dead + pending kept
    expect(items.find((i) => i.sequence === 1)).toBeUndefined();
  });

  it("clears the drain guard so a fresh drain runs after restart", async () => {
    // Guard is module-internal; drainOnStartup must clear it. We test the
    // observable behavior: after restart reset, drain processes items normally.
    rafChrome(seedQueue([makeItem({ status: "in_flight", sequence: 1 })]));
    const post = mock(async () => okOutcome);
    await drainOnStartup();
    await drain(hooks(post).ctx);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("bounded storage metadata", () => {
  it("caps per-item history at the max", async () => {
    const item = makeItem({
      sequence: 1,
      history: Array.from({ length: QUEUE_MAX_HISTORY }, (_, i) => ({
        at: i,
        status: null,
        error: `Old error ${i}`,
      })),
    });
    rafChrome(seedQueue([item]));
    await drain(hooks(async () => throwOutcome).ctx);
    const [stored] = chromeMock.store.queueItems ?? [];
    expect(stored?.history.length).toBeLessThanOrEqual(QUEUE_MAX_HISTORY);
  });

  it("truncates long error strings", async () => {
    const longErr = `x`.repeat(500);
    await drain(
      hooks(async () => ({
        fetchThrew: true,
        status: null,
        errorMessage: longErr,
      })).ctx,
    );
    const [stored] = chromeMock.store.queueItems ?? [];
    expect((stored?.lastError ?? "").length).toBeLessThanOrEqual(200);
  });

  it("tags each queue item with its source entry point", async () => {
    const sources = ["command", "contextmenu", "popup", "x_capture"] as const;
    for (const src of sources) {
      const item = await enqueue(
        {
          url: `https://src-${src}.test`,
          title: null,
          workspaceId: null,
          source: src,
        },
        { notifyOfflineQueued: () => undefined },
      );
      expect(item.source).toBe(src);
    }
  });
});

describe("seedFailedAttempt (offline double-POST prevention)", () => {
  it("a save that failed inline is NOT re-POSTed immediately by the heartbeat drain", async () => {
    // Simulates: user offline → saveOrEnqueue inline POST fails transiently →
    // enqueue with a seeded failed attempt → next drain must wait for backoff,
    // NOT re-fire the POST right away.
    const post = mock(async () => throwOutcome);
    await enqueue(
      {
        url: "https://offline.test",
        title: null,
        workspaceId: null,
        source: "command",
        seedFailedAttempt: { status: null, errorMessage: "Failed to fetch" },
      },
      { notifyOfflineQueued: () => undefined },
    );
    const [seeded] = chromeMock.store.queueItems ?? [];
    expect(seeded?.attempts).toBe(1);
    expect((seeded?.nextAttemptAt ?? 0) > Date.now()).toBe(true);

    // The very next drain (e.g. heartbeat 0 min later) must not re-POST.
    await drain(hooks(post).ctx);
    expect(post).not.toHaveBeenCalled();
  });

  it("an inline 429 seed honors the explicit Retry-After delay, not backoff", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.now());
    const retryAfterMs = 120_000; // 2 minutes
    await enqueue(
      {
        url: "https://rate.test",
        title: null,
        workspaceId: null,
        source: "command",
        seedFailedAttempt: { status: 429, retryAfterMs },
      },
      { notifyOfflineQueued: () => undefined },
    );
    const [seeded] = chromeMock.store.queueItems ?? [];
    expect((seeded?.nextAttemptAt ?? 0) - Date.now()).toBe(retryAfterMs);
  });
});

describe("heartbeat", () => {
  it("reuses the existing keepAlive alarm as the queue heartbeat (1-min period)", () => {
    installHeartbeat();
    const alarm = chromeMock.createdAlarms.find((a) => a.name === "keepAlive");
    expect(alarm).toBeDefined();
    expect(alarm?.periodInMinutes).toBe(1);
  });
});

describe("pause/resume", () => {
  it("isPaused reflects the persisted flag", async () => {
    expect(await isPaused()).toBe(false);
    await pauseQueue();
    expect(await isPaused()).toBe(true);
    await resumeQueue();
    expect(await isPaused()).toBe(false);
  });
});

// Helper: reset the shared chrome.storage state for a test. Directly assign
// instead of using the mock's `store` path so seeds land exactly.
function rafChrome(state: Store): void {
  clearStore(chromeMock.store);
  Object.assign(chromeMock.store, state);
}
