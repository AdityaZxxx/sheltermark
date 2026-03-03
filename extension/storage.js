// Sheltermark Extension - Storage Helpers

import { DEFAULT_BASE_URL } from "./constants.js";

const STORAGE_KEYS = {
  BASE_URL: "baseUrl",
  LAST_WORKSPACE: "lastWorkspace",
};

export async function getBaseUrl() {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.BASE_URL);
  return result[STORAGE_KEYS.BASE_URL] || DEFAULT_BASE_URL;
}

export async function setBaseUrl(url) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.BASE_URL]: url });
}

export async function getLastWorkspace() {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.LAST_WORKSPACE);
  return result[STORAGE_KEYS.LAST_WORKSPACE] || null;
}

export async function setLastWorkspace(workspaceId) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.LAST_WORKSPACE]: workspaceId });
}
