import {
  DEFAULT_BASE_URL,
  type TagWithCount,
  type Workspace,
} from "./constants.js";
import {
  baseUrlStorageSchema,
  cachedTagsSchema,
  cachedWorkspacesSchema,
  lastWorkspaceStorageSchema,
} from "./schema.js";

const STORAGE_KEYS = {
  BASE_URL: "baseUrl",
  LAST_WORKSPACE: "lastWorkspace",
} as const;

export async function getBaseUrl(): Promise<string> {
  const parsed = baseUrlStorageSchema.safeParse(
    await chrome.storage.sync.get(STORAGE_KEYS.BASE_URL),
  );
  return parsed.success ? parsed.data.baseUrl : DEFAULT_BASE_URL;
}

export async function setBaseUrl(url: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.BASE_URL]: url });
}

export async function getLastWorkspace(): Promise<string | null> {
  const parsed = lastWorkspaceStorageSchema.safeParse(
    await chrome.storage.local.get(STORAGE_KEYS.LAST_WORKSPACE),
  );
  return parsed.success ? parsed.data.lastWorkspace : null;
}

export async function setLastWorkspace(workspaceId: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LAST_WORKSPACE]: workspaceId,
  });
}

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

// A failed parse is a cache miss: the caller re-fetches and overwrites the
// entry, so a corrupt or stale-format value repairs itself on the next read.
export async function getCachedWorkspaces(): Promise<CachedEntry<
  Workspace[]
> | null> {
  const parsed = cachedWorkspacesSchema.safeParse(
    await chrome.storage.session.get(SESSION_KEYS.WORKSPACES),
  );
  return parsed.success ? parsed.data.cachedWorkspaces : null;
}

export async function setCachedWorkspaces(
  workspaces: Workspace[],
): Promise<void> {
  const baseUrl = await getBaseUrl();
  await chrome.storage.session.set({
    [SESSION_KEYS.WORKSPACES]: {
      value: workspaces,
      updatedAt: Date.now(),
      baseUrl,
    },
  });
}

export async function getCachedTags(): Promise<CachedEntry<
  TagWithCount[]
> | null> {
  const parsed = cachedTagsSchema.safeParse(
    await chrome.storage.session.get(SESSION_KEYS.TAGS),
  );
  return parsed.success ? parsed.data.cachedTags : null;
}

export async function setCachedTags(tags: TagWithCount[]): Promise<void> {
  const baseUrl = await getBaseUrl();
  await chrome.storage.session.set({
    [SESSION_KEYS.TAGS]: { value: tags, updatedAt: Date.now(), baseUrl },
  });
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
