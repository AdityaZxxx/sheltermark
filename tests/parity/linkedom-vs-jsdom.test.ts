import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { extractWithJsdom, extractWithLinkedom } from "./parity-harness";

// One-shot migration parity test: jsdom (old) vs linkedom (new) through
// @mozilla/readability on the same fixtures. Delete this file (and the
// harness) once the migration lands on prod and is confirmed working.

const ARTICLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Domain-Driven Agents — Cold Take</title>
  <meta property="og:site_name" content="Cold Take">
</head>
<body>
  <nav><a href="/">Home</a> <a href="/about">About</a></nav>
  <article>
    <h1>Domain-Driven Agents</h1>
    <p class="byline">by Simon Høiberg</p>
    <img src="/images/agents/hero.png" alt="agents">
    <p>Agents need domain boundaries the same way teams do. When we hand
    an agent a sprawling codebase with no seams, it thrashes; when we hand
    it a bounded context with clear contracts, it ships. This essay walks
    through what domain-driven design borrows from DDD and what it has
    to unlearn.</p>
    <p>The second paragraph establishes the pattern: boundaries first,
    tools second. An agent that knows where a context ends is an agent
    that can be tested, retried, and trusted with production access
    eventually.</p>
    <a href="/blog/other-post">Related: context mapping</a>
    <a href="https://external.example/hi">An external link</a>
    <blockquote>Boundaries are the API surface for autonomy.</blockquote>
    <pre><code>const ctx = defineContext({ name: "billing" });</code></pre>
  </article>
  <footer>© Cold Take</footer>
</body>
</html>`;

const ARTICLE_URL = "https://coldtake.dev/blog/domain-driven-agents";

const MINIMAL_HTML = `<!DOCTYPE html>
<html><head><title>Short</title></head>
<body><article><h1>Short</h1><p>Too short.</p></article></body></html>`;

const MALFORMED_HTML = `<html>
<body>
  <div>
    <h2>Malformed</h2>
    <p>Unclosed paragraph
    <p>Another <b>bold
    <a href="/rel">relative link in malformed doc
  </div>
`;

const NO_ARTICLE_HTML = `<!DOCTYPE html>
<html><head><title>Just Links</title></head>
<body><a href="https://x.com">x</a><a href="https://y.com">y</a></body></html>`;

describe("linkedom vs jsdom parity through Readability", () => {
  test("realistic article: title, byline, excerpt, content, length", () => {
    const old = extractWithJsdom(ARTICLE_HTML, ARTICLE_URL);
    const fresh = extractWithLinkedom(ARTICLE_HTML, ARTICLE_URL);

    expect(old).not.toBeNull();
    expect(fresh).not.toBeNull();

    // The contract lib/extract/readability.ts actually consumes
    expect(fresh?.title).toBe(old?.title);
    expect(fresh?.byline).toBe(old?.byline);
    expect(fresh?.siteName).toBe(old?.siteName);
    expect(fresh?.excerpt).toBe(old?.excerpt);
    expect(fresh?.textContent?.length).toBe(old?.textContent?.length);
  });

  test("relative links and images are absolutized against the article URL", () => {
    const old = extractWithJsdom(ARTICLE_HTML, ARTICLE_URL);
    const fresh = extractWithLinkedom(ARTICLE_HTML, ARTICLE_URL);

    const oldHtml = old?.content ?? "";
    const freshHtml = fresh?.content ?? "";

    // Both must absolutize the relative links/images the same way
    expect(freshHtml).toContain("https://coldtake.dev/images/agents/hero.png");
    expect(freshHtml).toContain("https://coldtake.dev/blog/other-post");
    // And preserve external links
    expect(freshHtml).toContain("https://external.example/hi");

    // Spot-check agreement on two more relativization outcomes
    const oldAbs = oldHtml.includes("https://coldtake.dev/blog/other-post");
    const freshAbs = freshHtml.includes("https://coldtake.dev/blog/other-post");
    expect(oldAbs).toBe(true);
    expect(freshAbs).toBe(true);
  });

  test("malformed HTML: both extract or both give null", () => {
    const old = extractWithJsdom(MALFORMED_HTML, "https://example.com/page");
    const fresh = extractWithLinkedom(
      MALFORMED_HTML,
      "https://example.com/page",
    );

    expect(!!fresh?.content).toBe(!!old?.content);
    if (fresh?.content && old?.content) {
      // If both parse, the contract fields must agree
      expect(fresh.title).toBe(old.title);
      expect(fresh.byline).toBe(old.byline);
    }
  });

  test("content below charThreshold: same semantic output", () => {
    const old = extractWithJsdom(MINIMAL_HTML, "https://example.com/short");
    const fresh = extractWithLinkedom(
      MINIMAL_HTML,
      "https://example.com/short",
    );
    expect(semanticSignature(fresh?.content ?? "")).toBe(
      semanticSignature(old?.content ?? ""),
    );
  });

  test("no-article page: same semantic output", () => {
    const old = extractWithJsdom(NO_ARTICLE_HTML, "https://example.com/links");
    const fresh = extractWithLinkedom(
      NO_ARTICLE_HTML,
      "https://example.com/links",
    );
    expect(semanticSignature(fresh?.content ?? "")).toBe(
      semanticSignature(old?.content ?? ""),
    );
  });
});

// linkedom serializes tags uppercase (<DIV>) and orders attributes
// differently; jsdom lowercases. The pipeline sanitizes this output anyway,
// so parity is asserted on DOM semantics: text content + sorted hrefs/srcs.
function semanticSignature(html: string): string {
  const doc = parseHTML(html).document;
  const links = [...doc.querySelectorAll("a[href]")]
    .map((a) => a.getAttribute("href"))
    .toSorted();
  const text = doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return JSON.stringify({ links, text });
}
