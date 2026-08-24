(() => {
  let lastPath = location.pathname;

  function ping(): void {
    try {
      // Fire-and-forget: the background decides whether a session actually
      // exists and whether anything queued needs syncing.
      chrome.runtime
        .sendMessage({ type: "AUTH_MAYBE_RESTORED" })
        .catch(() => {});
    } catch {
      // Stale script after extension reload/disable; the next full page
      // load gets a fresh injection.
    }
  }

  ping();

  // Same-document (SPA) navigations — e.g. the client-side redirect from
  // /login to /dashboard after password login — do not re-inject content
  // scripts. The Navigation API covers those; full loads are handled by the
  // initial ping above. Chromium-only API; this extension targets Chromium.
  if ("navigation" in window) {
    navigation.addEventListener("currententrychange", () => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        ping();
      }
    });
  }
})();
