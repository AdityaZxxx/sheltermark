/// <reference types="chrome" />
/**
 * Pins the absent-key contract: an install that predates this setting has no
 * stored value, and must still read as enabled — a `false` default would
 * silently disable capture for every existing user.
 *
 * The chrome lookalike is installed before first call, not before import;
 * settings.ts touches the global lazily from inside its async functions.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from "bun:test";

import { STORAGE_KEYS } from "~/extension/constants.js";
import { isXCaptureEnabled, setXCaptureEnabled } from "~/extension/settings.js";

interface Store {
  [STORAGE_KEYS.X_CAPTURE_ENABLED]?: boolean;
}

function makeChromeMock(initial: Store = {}) {
  const store: Store = { ...initial };

  const chrome = {
    storage: {
      sync: {
        // The real overload substitutes the caller's default for any key the
        // store does not hold — the behaviour the absent-key test relies on.
        get: mock(async (defaults: Store = {}) => {
          const out: Store = { ...defaults };
          const stored = store[STORAGE_KEYS.X_CAPTURE_ENABLED];
          if (stored !== undefined) {
            out[STORAGE_KEYS.X_CAPTURE_ENABLED] = stored;
          }
          return out;
        }),
        set: mock(async (items: Store) => {
          Object.assign(store, items);
        }),
      },
    },
  };

  return { chrome, store };
}

const chromeMock = makeChromeMock();
// SAFETY: in a browser extension `chrome` is the extension global; the test
// installs a lookalike here so the (unmocked) settings module uses it.
// @ts-expect-error - installs a chrome.* lookalike over the browser-extension global types so unmocked settings code uses it.
globalThis.chrome = chromeMock.chrome;

beforeEach(() => {
  delete chromeMock.store[STORAGE_KEYS.X_CAPTURE_ENABLED];
  chromeMock.chrome.storage.sync.get.mockClear();
  chromeMock.chrome.storage.sync.set.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("x-capture enabled flag", () => {
  it("reads as enabled when the key was never written", async () => {
    expect(await isXCaptureEnabled()).toBe(true);
  });

  it("reads back what was written", async () => {
    await setXCaptureEnabled(false);
    expect(await isXCaptureEnabled()).toBe(false);
  });

  it("round-trips back to enabled", async () => {
    await setXCaptureEnabled(false);
    await setXCaptureEnabled(true);
    expect(await isXCaptureEnabled()).toBe(true);
  });

  it("writes under the shared storage key", async () => {
    await setXCaptureEnabled(false);
    expect(chromeMock.store[STORAGE_KEYS.X_CAPTURE_ENABLED]).toBe(false);
  });
});
