/**
 * Deliberately zod-free: the x-capture content script imports this, and a
 * single `z.boolean().default(true)` bundles to ~300KB minified against a 2KB
 * script. The boundary contract is carried by the typed-defaults overload of
 * `chrome.storage.get` instead.
 *
 * That contract is compile-time only — a non-boolean written to the key
 * out-of-band would pass through unvalidated.
 */
import { DEFAULT_X_CAPTURE_ENABLED, STORAGE_KEYS } from "./constants.js";

type XCaptureStorage = Record<
  (typeof STORAGE_KEYS)["X_CAPTURE_ENABLED"],
  boolean
>;

export async function isXCaptureEnabled(): Promise<boolean> {
  const stored = await chrome.storage.sync.get<XCaptureStorage>({
    [STORAGE_KEYS.X_CAPTURE_ENABLED]: DEFAULT_X_CAPTURE_ENABLED,
  });
  return stored[STORAGE_KEYS.X_CAPTURE_ENABLED];
}

export async function setXCaptureEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.X_CAPTURE_ENABLED]: enabled,
  });
}
