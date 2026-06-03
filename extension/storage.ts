import { DEFAULT_BASE_URL } from "./constants.js";

const STORAGE_KEYS = {
  BASE_URL: "baseUrl",
  LAST_WORKSPACE: "lastWorkspace",
} as const;

export async function getBaseUrl(): Promise<string> {
  const result = (await chrome.storage.sync.get(
    STORAGE_KEYS.BASE_URL,
  )) as Record<string, string>;
  return result[STORAGE_KEYS.BASE_URL] || DEFAULT_BASE_URL;
}

export async function setBaseUrl(url: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.BASE_URL]: url });
}

export async function getLastWorkspace(): Promise<string | null> {
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
