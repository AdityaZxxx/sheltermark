import {
  DEFAULT_BASE_URL,
  type TagWithCount,
  type Workspace,
} from "./constants.js";

const STORAGE_KEYS = {
  BASE_URL: "baseUrl",
  LAST_WORKSPACE: "lastWorkspace",
} as const;

export async function getBaseUrl(): Promise<string> {
  // SAFETY: this extension is the only writer of the `baseUrl` key, and
  // setBaseUrl always stores a trimmed http(s) URL string.
  const result = (await chrome.storage.sync.get(
    STORAGE_KEYS.BASE_URL,
  )) as Record<string, string>;
  return result[STORAGE_KEYS.BASE_URL] || DEFAULT_BASE_URL;
}

export async function setBaseUrl(url: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.BASE_URL]: url });
}

export async function getLastWorkspace(): Promise<string | null> {
  // SAFETY: this extension is the only writer of `lastWorkspace`, and
  // setLastWorkspace always stores a workspace id string.
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.LAST_WORKSPACE,
  )) as Record<string, string>;
  return result[STORAGE_KEYS.LAST_WORKSPACE] || null;
}

export async function setLastWorkspace(workspaceId: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LAST_WORKSPACE]: workspaceId,
  });
}

// ------------------- Session cache -------------------
//
// Popup data (workspaces, tags) cached in chrome.storage.session so it survives
// MV3 service-worker restarts and lets the popup render from a ~1-3ms local read
// instead of waiting on 2-3 sequential network round-trips + a cold SW wake.
// Cleared automatically on browser exit. Entries are keyed per baseUrl so a
// self-hosted instance's data never leaks into another instance's popup.

const SESSION_KEYS = {
  WORKSPACES: "cachedWorkspaces",
  TAGS: "cachedTags",
} as const;

export const MAX_CACHE_AGE_MS = 5 * 60_000; // 5 minutes

export interface CachedEntry<T> {
  value: T;
  updatedAt: number;
  baseUrl: string;
}

async function getCachedEntry<T>(key: string): Promise<CachedEntry<T> | null> {
  // SAFETY: this extension is the only writer of the session cache keys, and
  // setCachedEntry always stores a CachedEntry envelope for key `key`. The
  // Array.isArray check below re-validates the payload shape at runtime.
  const result = (await chrome.storage.session.get(key)) as Record<
    string,
    CachedEntry<T> | undefined
  >;
  const entry = result[key];
  if (!entry || !Array.isArray(entry.value)) return null;
  return entry;
}

async function setCachedEntry<T>(key: string, value: T): Promise<void> {
  const baseUrl = await getBaseUrl();
  await chrome.storage.session.set({
    [key]: { value, updatedAt: Date.now(), baseUrl },
  });
}

export async function getCachedWorkspaces(): Promise<CachedEntry<
  Workspace[]
> | null> {
  return getCachedEntry<Workspace[]>(SESSION_KEYS.WORKSPACES);
}

export async function setCachedWorkspaces(
  workspaces: Workspace[],
): Promise<void> {
  await setCachedEntry(SESSION_KEYS.WORKSPACES, workspaces);
}

export async function getCachedTags(): Promise<CachedEntry<
  TagWithCount[]
> | null> {
  return getCachedEntry<TagWithCount[]>(SESSION_KEYS.TAGS);
}

export async function setCachedTags(tags: TagWithCount[]): Promise<void> {
  await setCachedEntry(SESSION_KEYS.TAGS, tags);
}

export async function clearDataCaches(): Promise<void> {
  await chrome.storage.session.remove([
    SESSION_KEYS.WORKSPACES,
    SESSION_KEYS.TAGS,
  ]);
}

export async function isCacheStale(entry: {
  updatedAt: number;
  baseUrl: string;
}): Promise<boolean> {
  const baseUrl = await getBaseUrl();
  if (entry.baseUrl !== baseUrl) return true;
  const now = Date.now();
  // Clock-skew guard: a negative age means the cache was written in the
  // "future" (system clock moved backwards); treat it as fresh rather than
  // re-fetching on every read.
  if (entry.updatedAt > now) return false;
  return now - entry.updatedAt > MAX_CACHE_AGE_MS;
}
