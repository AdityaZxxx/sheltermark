import { describe, expect, it } from "bun:test";

import { sanitizeContent } from "~/lib/extract/sanitize";

// Gate 2 (ADR-0007): the extracted HTML is untrusted third-party content
// served from Sheltermark's origin, so these fixtures must prove every known
// injection vector is stripped. A regression here is an XSS in our own origin.

describe("sanitizeContent", () => {
  describe("script execution", () => {
    it("strips <script> tags and their content", () => {
      const out = sanitizeContent(
        `<p>a</p><script>alert("xss")</script><p>b</p>`,
      );
      expect(out).not.toContain("<script");
      expect(out).not.toContain("alert");
      expect(out).toContain("<p>a</p>");
      expect(out).toContain("<p>b</p>");
    });

    it("strips inline event handlers", () => {
      const out = sanitizeContent(
        `<img src="https://x.com/i.png" onerror="steal()" onclick="evil()">`,
      );
      expect(out).not.toContain("onerror");
      expect(out).not.toContain("onclick");
      expect(out).not.toContain("steal");
    });
  });

  describe("url schemes", () => {
    it("strips javascript: hrefs", () => {
      const out = sanitizeContent(`<a href="javascript:alert(1)">x</a>`);
      expect(out).not.toContain("javascript:");
    });

    it("strips data: URLs on img src", () => {
      const out = sanitizeContent(
        `<img src="data:text/html,<script>alert(1)</script>">`,
      );
      expect(out).not.toContain("data:");
    });

    it("strips vbscript: hrefs", () => {
      const out = sanitizeContent(`<a href="vbscript:msgbox(1)">x</a>`);
      expect(out).not.toContain("vbscript:");
    });

    it("keeps valid https image src", () => {
      const out = sanitizeContent(
        `<img src="https://example.com/a.png" alt="ok">`,
      );
      expect(out).toContain("https://example.com/a.png");
    });
  });

  describe("svg and embedded documents", () => {
    it("strips svg payloads", () => {
      const out = sanitizeContent(
        `<svg><script>alert(1)</script><rect/></svg>`,
      );
      expect(out).not.toContain("<svg");
    });

    it("strips nested iframe/object/embed", () => {
      const out = sanitizeContent(
        `<p>a</p><iframe src="https://evil.com"></iframe><object data="x"></object><embed src="y">`,
      );
      expect(out).not.toContain("<iframe");
      expect(out).not.toContain("<object");
      expect(out).not.toContain("<embed");
    });
  });

  describe("forms and meta", () => {
    it("strips <form> and <input>", () => {
      const out = sanitizeContent(
        `<form action="https://evil.com"><input name="pw" value="secret"></form>`,
      );
      expect(out).not.toContain("<form");
      expect(out).not.toContain("<input");
      expect(out).not.toContain("secret");
    });

    it("strips <meta http-equiv=refresh>", () => {
      const out = sanitizeContent(
        `<meta http-equiv="refresh" content="0;url=https://evil.com">`,
      );
      expect(out).not.toContain("http-equiv");
      expect(out).not.toContain("evil.com");
    });
  });

  describe("css escapes and style", () => {
    it("strips </style> breakout", () => {
      const out = sanitizeContent(`<style></style><script>alert(1)</script>`);
      expect(out).not.toContain("<style");
      expect(out).not.toContain("<script");
    });

    it("strips inline style attributes (url exfiltration)", () => {
      const out = sanitizeContent(
        `<p style="background:url(https://evil.com/track)">x</p>`,
      );
      expect(out).not.toContain("style=");
      expect(out).not.toContain("evil.com");
    });

    it("strips style tags with css escapes", () => {
      const out = sanitizeContent(
        `<style>body{background:url(javascript:alert(1))}</style>`,
      );
      expect(out).not.toContain("<style");
    });
  });

  describe("link hardening", () => {
    it("adds rel=noopener noreferrer and target=_blank", () => {
      const out = sanitizeContent(`<a href="https://example.com">x</a>`);
      expect(out).toContain('rel="noopener noreferrer"');
      expect(out).toContain('target="_blank"');
    });

    it("overrides attacker-supplied target and rel (opener tricks)", () => {
      const out = sanitizeContent(
        `<a href="https://example.com" target="_parent" rel="opener">x</a>`,
      );
      expect(out).toBe(
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
      );
      expect(out).not.toContain("_parent");
      expect(out).not.toContain('rel="opener"');
    });
  });

  describe("structure", () => {
    it("preserves safe content and normalizes case", () => {
      const out = sanitizeContent(
        `<H1>Title</H1><P>Body</P><UL><LI>Item</LI></UL>`,
      );
      expect(out).toContain("<h1>Title</h1>");
      expect(out).toContain("<p>Body</p>");
      expect(out).toContain("<li>Item</li>");
    });
  });
});
