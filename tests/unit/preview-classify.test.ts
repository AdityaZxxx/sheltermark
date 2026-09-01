import { describe, expect, it } from "bun:test";

import { classifyContentType, classifyUrl } from "~/lib/preview/classify";

describe("classifyContentType (authoritative, header-driven)", () => {
  it("maps PDF mime types to pdf", () => {
    expect(classifyContentType("application/pdf")).toBe("pdf");
    expect(classifyContentType("application/pdf; charset=utf-8")).toBe("pdf");
    expect(classifyContentType("application/x-pdf")).toBe("pdf");
  });

  it("maps image/video/audio prefixes", () => {
    expect(classifyContentType("image/png")).toBe("image");
    expect(classifyContentType("image/webp")).toBe("image");
    expect(classifyContentType("video/mp4")).toBe("video");
    expect(classifyContentType("audio/mpeg")).toBe("audio");
  });

  it("maps HTML-ish documents to html", () => {
    expect(classifyContentType("text/html")).toBe("html");
    expect(classifyContentType("text/html; charset=utf-8")).toBe("html");
    expect(classifyContentType("application/xhtml+xml")).toBe("html");
    expect(classifyContentType("text/plain")).toBe("html");
  });

  it("returns null for unknown or missing content types", () => {
    expect(classifyContentType(null)).toBeNull();
    expect(classifyContentType("")).toBeNull();
    expect(classifyContentType("application/octet-stream")).toBeNull();
    expect(classifyContentType("application/json")).toBeNull();
  });
});

describe("classifyUrl (optimistic, pre-fetch)", () => {
  it("detects PDF file extensions", () => {
    expect(classifyUrl("https://example.com/paper.pdf")).toBe("pdf");
    expect(classifyUrl("https://example.com/a/b/report.PDF")).toBe("pdf");
  });

  it("detects arXiv-style /pdf/<id> paths without extensions", () => {
    expect(classifyUrl("https://arxiv.org/pdf/2401.12345")).toBe("pdf");
    expect(classifyUrl("https://arxiv.org/pdf/2401.12345v2")).toBe("pdf");
  });

  it("does not misread arXiv abstract pages as PDFs", () => {
    expect(classifyUrl("https://arxiv.org/abs/2401.12345")).toBeNull();
  });

  it("detects image, video, and audio extensions", () => {
    expect(classifyUrl("https://example.com/pic.webp")).toBe("image");
    expect(classifyUrl("https://example.com/clip.mp4")).toBe("video");
    expect(classifyUrl("https://example.com/track.opus")).toBe("audio");
  });

  it("returns null for HTML-ish and extension-less URLs", () => {
    expect(classifyUrl("https://example.com/post/123")).toBeNull();
    expect(classifyUrl("https://example.com/")).toBeNull();
    expect(classifyUrl("https://example.com/readme.md")).toBeNull();
  });

  it("does not misread route segments as file extensions", () => {
    expect(classifyUrl("https://example.com/uploads/mp3")).toBeNull();
    expect(classifyUrl("https://example.com/img/png")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(classifyUrl("not a url")).toBeNull();
  });
});
