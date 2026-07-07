// Sheltermark X/Twitter Bookmark Capture
// Content script: captures bookmark events on X/Twitter via DOM listener

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

  function isCanonicalTweetUrl(url) {
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

  function extractTweetUrl(url) {
    const match = url.match(TWEET_URL_PATTERN);
    if (!match) return null;
    const domain = match[1];
    const username = match[2];
    const tweetId = match[3];
    return `https://${domain}/${username}/status/${tweetId}`;
  }

  function findBookmarkButtons(root) {
    return root.querySelectorAll(
      '[data-testid="bookmark"], [data-testid="removeBookmark"]',
    );
  }

  function findClosestTweetArticle(el) {
    return el.closest('article[data-testid="tweet"]');
  }

  function extractTweetUrlFromArticle(article) {
    if (!article) return null;

    const timeLink = article.querySelector("a time");
    if (timeLink) {
      const anchor = timeLink.closest("a");
      if (anchor && isCanonicalTweetUrl(anchor.href)) {
        return extractTweetUrl(anchor.href);
      }
    }

    const links = article.querySelectorAll('a[href*="/status/"]');
    for (const link of links) {
      if (isCanonicalTweetUrl(link.href)) {
        return extractTweetUrl(link.href);
      }
    }

    return null;
  }

  function sendBookmarkMessage(tweetUrl) {
    chrome.runtime
      .sendMessage({
        type: "X_BOOKMARK_CAPTURED",
        url: tweetUrl,
      })
      .catch((error) => {
        console.error("[Sheltermark] Failed to send message:", error);
      });
  }

  const processedClicks = new WeakSet();

  function attachBookmarkListeners(root) {
    const buttons = findBookmarkButtons(root);
    for (const btn of buttons) {
      if (processedClicks.has(btn)) continue;
      processedClicks.add(btn);

      btn.addEventListener(
        "click",
        (e) => {
          const isBookmarkAction =
            e.currentTarget.getAttribute("data-testid") === "bookmark";
          if (!isBookmarkAction) return;

          const article = findClosestTweetArticle(e.currentTarget);
          const tweetUrl = extractTweetUrlFromArticle(article);
          if (!tweetUrl) return;

          sendBookmarkMessage(tweetUrl);
        },
        { capture: true },
      );
    }
  }

  attachBookmarkListeners(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        attachBookmarkListeners(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
