import { afterEach, describe, expect, it } from "bun:test";

import { getBaseUrl, normalizeUrl, safeDomain, slugify } from "~/lib/utils";

describe("normalizeUrl", () => {
  it("lowercases hostname", () => {
    expect(normalizeUrl("https://Example.COM/path")).toBe(
      "https://example.com/path",
    );
  });

  it("strips www prefix", () => {
    expect(normalizeUrl("https://www.example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("removes UTM tracking params", () => {
    const url =
      "https://example.com/page?utm_source=google&utm_medium=cpc&keep=1";
    expect(normalizeUrl(url)).toBe("https://example.com/page?keep=1");
  });

  it("removes fbclid and gclid", () => {
    const url = "https://example.com/page?fbclid=abc&gclid=def&q=search";
    expect(normalizeUrl(url)).toBe("https://example.com/page?q=search");
  });

  it("removes hash fragment", () => {
    const url = "https://example.com/page#section";
    expect(normalizeUrl(url)).toBe("https://example.com/page");
  });

  it("removes trailing slash on non-root paths", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe(
      "https://example.com/page",
    );
  });

  it("preserves root trailing slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("returns original string on invalid URL", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces special chars with hyphens", () => {
    expect(slugify("My Bookmarks! @home")).toBe("my-bookmarks-home");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });
});

describe("safeDomain", () => {
  it("extracts hostname from URL", () => {
    expect(safeDomain("https://www.example.com/page")).toBe("www.example.com");
  });

  it("returns original on invalid URL", () => {
    expect(safeDomain("")).toBe("");
  });
});

describe("getBaseUrl", () => {
  const origSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const origVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = origSiteUrl;
    process.env.VERCEL_URL = origVercelUrl;
  });

  it("falls back to localhost", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://mysite.com";
    delete process.env.VERCEL_URL;
    expect(getBaseUrl()).toBe("https://mysite.com");
  });
});
