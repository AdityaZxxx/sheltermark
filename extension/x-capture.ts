(() => {
  const TWEET_URL_PATTERN =
    /^https?:\/\/(x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/;

  const NON_TWEET_PATH_PREFIXES = [
    "/settings",
    "/search",
    "/explore",
    "/messages",
    "/notifications",
    "/home",
    "/lists",
    "/i/",
    "/compose",
  ];

  function isCanonicalTweetUrl(url: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      if (NON_TWEET_PATH_PREFIXES.some((p) => path.startsWith(p))) return false;
      return TWEET_URL_PATTERN.test(url);
    } catch {
      return false;
    }
  }

  function extractTweetUrl(url: string): string | null {
    const match = url.match(TWEET_URL_PATTERN);
    // Groups 1-3 exist whenever the pattern matches (verified by the truthy
    // guard), so the indices are safe without assertions.
    if (!match || !match[1] || !match[2] || !match[3]) return null;
    const [, domain, username, tweetId] = match;
    return `https://${domain}/${username}/status/${tweetId}`;
  }

  function sendBookmarkMessage(tweetUrl: string): void {
    // After an extension reload/disable, stale scripts in already-open tabs
    // throw synchronously here ("Extension context invalidated") — the
    // promise .catch below cannot see it, so the whole call is guarded.
    try {
      chrome.runtime
        .sendMessage({
          type: "X_BOOKMARK_CAPTURED",
          url: tweetUrl,
        })
        .catch((error: Error) => {
          console.error(`[Sheltermark] Failed to send X bookmark message`, {
            tweetUrl,
            error,
          });
        });
    } catch {
      // Runtime binding is dead; the page needs a reload to re-capture.
    }
  }

  // X serves two frontend variants in parallel (staged rollout): the legacy
  // UI keyed by data-testid, and the 2026 rebuild keyed by svg[data-icon] +
  // aria-pressed with no data-testid anywhere. Both must be handled.

  function isBookmarkButton(button: Element): boolean {
    const testId = button.getAttribute("data-testid");
    if (testId) return testId === "bookmark" || testId === "removeBookmark";
    return button.querySelector('svg[data-icon^="icon-bookmark"]') !== null;
  }

  function isBookmarkAction(button: Element): boolean {
    const testId = button.getAttribute("data-testid");
    // Legacy UI: the testid itself flips to "removeBookmark" once bookmarked.
    // Rebuild: aria-pressed is still "false" at this point because capture
    // phase runs before X flips it.
    if (testId) return testId === "bookmark";
    return button.getAttribute("aria-pressed") === "false";
  }

  function findTweetUrl(article: Element | null): string | null {
    if (!article) return null;

    // Rebuild only: itemid microdata carries the tweet's own status id, which
    // disambiguates it from quoted-tweet links inside the article.
    const ownId = article.getAttribute("itemid")?.match(/status\/(\d+)/)?.[1];
    const matchesOwnId = (normalized: string): boolean =>
      !ownId || normalized.endsWith(`/status/${ownId}`);

    // Legacy UI: the timestamp anchor links to the tweet's own status; quoted-
    // tweet cards have no <time> element, so this is QT-safe.
    const timeAnchor = article.querySelector("a time")?.closest("a");
    if (
      timeAnchor &&
      timeAnchor.closest("article") === article &&
      isCanonicalTweetUrl(timeAnchor.href)
    ) {
      const normalized = extractTweetUrl(timeAnchor.href);
      if (normalized && matchesOwnId(normalized)) return normalized;
    }

    // Rebuild: quoted-tweet cards render as nested <article>s, excluded by the
    // closest-article check.
    const links = article.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/status/"]',
    );
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link || link.closest("article") !== article) continue;
      if (!isCanonicalTweetUrl(link.href)) continue;
      const normalized = extractTweetUrl(link.href);
      if (!normalized || !matchesOwnId(normalized)) continue;
      return normalized;
    }

    return null;
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!button || !isBookmarkButton(button)) return;
      if (!isBookmarkAction(button)) return;

      const tweetUrl = findTweetUrl(button.closest("article"));
      if (tweetUrl) sendBookmarkMessage(tweetUrl);
    },
    { capture: true },
  );
})();
