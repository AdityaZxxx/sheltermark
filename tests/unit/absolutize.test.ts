import { describe, expect, it } from "bun:test";

import { absolutize } from "~/lib/extract/absolutize";

describe("absolutize", () => {
  const base = "https://example.com/articles/post-1";

  it("rewrites relative hrefs against the base URL directory", () => {
    const out = absolutize(`<a href="next-post.html">next</a>`, base);
    expect(out).toContain("https://example.com/articles/next-post.html");
  });

  it("rewrites root-relative hrefs", () => {
    const out = absolutize(`<a href="/topics">topics</a>`, base);
    expect(out).toContain("https://example.com/topics");
  });

  it("rewrites relative img srcs", () => {
    const out = absolutize(`<img src="img/diagram.png">`, base);
    expect(out).toContain("https://example.com/articles/img/diagram.png");
  });

  it("leaves absolute URLs untouched", () => {
    const out = absolutize(
      `<a href="https://other.com/x">x</a><img src="https://other.com/y.png">`,
      base,
    );
    expect(out).toContain("https://other.com/x");
    expect(out).toContain("https://other.com/y.png");
  });

  it("leaves #fragment anchors relative for in-preview navigation", () => {
    const out = absolutize(`<a href="#section">s</a>`, base);
    expect(out).toContain('href="#section"');
  });

  it("resolves against a directory base with trailing slash", () => {
    const out = absolutize(
      `<a href="manual/01.md">m</a>`,
      "https://github.com/o/r/",
    );
    expect(out).toContain("https://github.com/o/r/manual/01.md");
  });
});
