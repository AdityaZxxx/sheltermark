/**
 * URL health checker for Sheltermark bookmarks.
 * Runs as a GitHub Actions cronjob (weekly via check-urls-health.yml).
 *
 * This file is intentionally thin: classification, error categorisation,
 * and soft-404 detection all live in `lib/link-health/checker.ts` so each
 * rule is unit-testable in isolation.
 *
 * Behavioural changes vs the previous version:
 *
 *   1. Removed the per-domain check cache. Cache poisoning meant one
 *      bad path on a host silently flagged every bookmark on that host
 *      as broken.
 *
 *   2. Errors thrown by the fetcher now become "unknown" — they no
 *      longer get collapsed into "alive". Timeouts are clearly
 *      distinguished from DNS failures so the cron summary can surface
 *      them and the UI's "couldn't be reached — status unknown" message
 *      renders them with the right severity.
 *
 *   3. Soft-404 detection requires multiple signals to fire. Body match
 *      alone, or title match alone, are no longer enough.
 *
 *   4. The persisted record is `broken_status` (the enum) plus
 *      `is_broken` (the legacy boolean, now derived). Backwards compat
 *      for the legacy UI is preserved.
 *
 *   5. Per-host throttling: at most one concurrent request per hostname.
 *      Prevents accidental DoS of a single domain and reduces 429s.
 *      Global concurrency is still capped at CONCURRENCY.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { z } from "zod";

import type { BrokenStatus, UrlHealthResult } from "~/lib/link-health/types";

import { cronActor, insertAuditEventSupabase } from "~/lib/audit";
import { checkUrl } from "~/lib/link-health/checker";
import { logger } from "~/lib/logger";
import { urlSchema, uuidSchema } from "~/lib/schemas/common";
import { safeDomain } from "~/lib/utils";

config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CONCURRENCY = 10;
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const MAX_BOOKMARKS_PER_RUN = 500;
const STALE_CHECK_DAYS = 7;

const bookmarkToCheckSchema = z.object({
  id: uuidSchema,
  url: urlSchema,
  user_id: uuidSchema,
});

type BookmarkToCheck = z.infer<typeof bookmarkToCheckSchema>;

interface RunSummary {
  checked: number;
  broken: number;
  likely: number;
  unknown: number;
  updated: number;
}

/**
 * Run a batch of async tasks with a global concurrency limit AND a
 * per-host limit of 1. Same-host tasks are serialised so we never
 * issue two concurrent requests to the same hostname — this prevents
 * accidental DoS and reduces 429s from rate-limiting servers.
 *
 * Implementation: each task awaits a per-host "previous task done"
 * promise before starting. The global limit is enforced separately by
 * tracking the set of in-flight tasks (waiting + running) and yielding
 * when it reaches the cap.
 */
async function runWithPerHostConcurrency<T>(
  tasks: { host: string; run: () => Promise<T> }[],
  globalLimit: number,
): Promise<T[]> {
  const lastPerHost = new Map<string, Promise<void>>();
  const results: Promise<T>[] = [];
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const prev = lastPerHost.get(task.host) ?? Promise.resolve();

    // Deferred that resolves when THIS task finishes (success or fail).
    // Used as the "previous" for the next same-host task.
    let release!: () => void;
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    lastPerHost.set(task.host, done);

    const promise = (async () => {
      // Wait for the previous same-host task to finish before starting
      // this one. Errors in the predecessor don't block — we just want
      // to avoid concurrency, not propagate failures.
      await prev;
      try {
        return await task.run();
      } finally {
        release();
      }
    })();

    // Track in `executing` for the global limit. Use a separate tracker
    // promise so we can remove it from the set when it settles.
    const tracker = promise.then(
      () => {
        executing.delete(tracker);
      },
      () => {
        executing.delete(tracker);
      },
    );
    executing.add(tracker);
    results.push(promise);

    if (executing.size >= globalLimit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

function isBrokenStatus(status: BrokenStatus): boolean {
  return status === "confirmed_broken" || status === "likely_broken";
}

/**
 * Persist a single check result.
 */
async function persistResult(
  bookmark: BookmarkToCheck,
  result: UrlHealthResult,
): Promise<{ written: boolean }> {
  const { error } = await supabase
    .from("bookmarks")
    .update({
      is_broken: isBrokenStatus(result.brokenStatus),
      broken_status: result.brokenStatus,
      http_status: result.httpStatus,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", bookmark.id)
    .eq("user_id", bookmark.user_id);

  if (error) {
    logger.error("Update failed", {
      bookmarkId: bookmark.id,
      message: error.message,
    });
    return { written: false };
  }
  return { written: true };
}

async function recordRun(summary: RunSummary): Promise<void> {
  // Privileged cross-user run: documented in docs/policies/data-access.md §5.
  // A run that cannot be audited is a failed run (§5.4), so this helper
  // throws rather than swallowing — callers decide the exit code.
  await insertAuditEventSupabase(supabase, {
    actorType: "cron",
    actorId: cronActor("check-urls"),
    action: "url_health_check.run",
    resourceType: "bookmark",
    reason: "Scheduled URL health check for auto-check workspaces",
    metadata: {
      checked: summary.checked,
      confirmedBroken: summary.broken,
      likelyBroken: summary.likely,
      unresolved: summary.unknown,
      updated: summary.updated,
    },
  });
}

function emptySummary(): RunSummary {
  return { checked: 0, broken: 0, likely: 0, unknown: 0, updated: 0 };
}

async function main(): Promise<void> {
  logger.info("Starting URL health check");

  const cutoff = new Date(
    Date.now() - STALE_CHECK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("id, url, user_id, workspaces!inner(auto_check_broken)")
    .eq("workspaces.auto_check_broken", true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(MAX_BOOKMARKS_PER_RUN);

  if (error) {
    logger.error("Fetch error", { message: error.message });
    process.exit(1);
  }
  if (!bookmarks?.length) {
    logger.info("No bookmarks need checking");
    // Still record the run: the audit trail must show the job ran and found
    // nothing (§5.3 promises one event per privileged run).
    await recordRun(emptySummary());
    return;
  }

  logger.info(`Checking ${bookmarks.length} bookmarks`);

  type CheckOutcome = {
    bookmark: BookmarkToCheck;
    result: UrlHealthResult;
    written: boolean;
  };

  const parsed = z.array(bookmarkToCheckSchema).safeParse(bookmarks ?? []);
  if (!parsed.success) {
    logger.error("Unexpected bookmark shape", {
      message: parsed.error.message,
    });
    process.exit(1);
  }
  const outcomes = await runWithPerHostConcurrency<CheckOutcome>(
    parsed.data.map((bm) => ({
      host: safeDomain(bm.url),
      run: async () => {
        const result = await checkUrl(bm.url, {
          retries: MAX_RETRIES,
          timeoutMs: TIMEOUT_MS,
        });
        const { written } = await persistResult(
          { id: bm.id, url: bm.url, user_id: bm.user_id },
          result,
        );
        return {
          bookmark: { id: bm.id, url: bm.url, user_id: bm.user_id },
          result,
          written,
        };
      },
    })),
    CONCURRENCY,
  );

  const summary: RunSummary = {
    checked: outcomes.length,
    broken: outcomes.filter((o) => o.result.brokenStatus === "confirmed_broken")
      .length,
    likely: outcomes.filter((o) => o.result.brokenStatus === "likely_broken")
      .length,
    unknown: outcomes.filter((o) => o.result.brokenStatus === "unknown").length,
    updated: outcomes.filter((o) => o.written).length,
  };
  logger.info("URL health check done", summary);

  await recordRun(summary);
}

main().catch((err) => {
  logger.error("Fatal error", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
