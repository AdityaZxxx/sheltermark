const DAILY_LIMIT = 10;

interface RateLimitEntry {
  date: string; // YYYY-MM-DD
  count: number;
}

interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
}

const store = new Map<string, RateLimitEntry>();

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks and increments rate limit for a user.
 * Returns true if under limit, false if rate limited.
 */
export function checkRateLimit(userId: string): RateLimitCheckResult {
  const today = getTodayKey();
  const entry = store.get(userId);

  if (!entry || entry.date !== today) {
    store.set(userId, { date: today, count: 1 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

/**
 * Returns remaining generations for a user today.
 */
export function getRemainingGenerations(userId: string): number {
  const today = getTodayKey();
  const entry = store.get(userId);
  if (!entry || entry.date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - entry.count);
}

// Periodic cleanup every hour to prevent memory leaks. Feature-detected with
// an `in` capability check so the module also loads in timer-less environments.
if ("setInterval" in globalThis) {
  setInterval(
    () => {
      const today = getTodayKey();
      for (const [userId, entry] of store) {
        if (entry.date !== today) {
          store.delete(userId);
        }
      }
    },
    60 * 60 * 1000,
  );
}
