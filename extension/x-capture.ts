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
    if (!match) return null;
    const domain = match[1] as string;
    const username = match[2] as string;
    const tweetId = match[3] as string;
    return `https://${domain}/${username}/status/${tweetId}`;
  }

  function findBookmarkButtons(root: Document | Element): NodeListOf<Element> {
    return root.querySelectorAll(
      '[data-testid="bookmark"], [data-testid="removeBookmark"]',
    );
  }

  function findClosestTweetArticle(el: Element): Element | null {
    return el.closest('article[data-testid="tweet"]');
  }

  function extractTweetUrlFromArticle(article: Element | null): string | null {
    if (!article) return null;

    const timeLink = article.querySelector("a time");
    if (timeLink) {
      const anchor = timeLink.closest("a");
      if (anchor && isCanonicalTweetUrl(anchor.href)) {
        return extractTweetUrl(anchor.href);
      }
    }

    const links = article.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/status/"]',
    );
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (link && isCanonicalTweetUrl(link.href)) {
        return extractTweetUrl(link.href);
      }
    }

    return null;
  }

  function sendBookmarkMessage(tweetUrl: string): void {
    chrome.runtime
      .sendMessage({
        type: "X_BOOKMARK_CAPTURED",
        url: tweetUrl,
      })
      .catch((error: unknown) => {
        console.error("[Sheltermark] Failed to send message:", error);
      });
  }

  const processedClicks = new WeakSet<Element>();

  function attachBookmarkListeners(root: Document | Element): void {
    const buttons = findBookmarkButtons(root);
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (!btn || processedClicks.has(btn)) continue;
      processedClicks.add(btn);

      btn.addEventListener(
        "click",
        (e: Event) => {
          const target = e.currentTarget as Element;
          const isBookmarkAction =
            target.getAttribute("data-testid") === "bookmark";
          if (!isBookmarkAction) return;

          const article = findClosestTweetArticle(target);
          const tweetUrl = extractTweetUrlFromArticle(article);
          if (!tweetUrl) return;

          sendBookmarkMessage(tweetUrl);
        },
        { capture: true },
      );
    }
  }

  attachBookmarkListeners(document);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      attachBookmarkListeners(document);
    }, 400);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
