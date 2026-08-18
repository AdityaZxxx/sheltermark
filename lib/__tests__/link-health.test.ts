import { afterEach, beforeEach, describe, expect, it, jest, spyOn } from "bun:test";
import {
  checkUrl,
  detectSoft404,
} from "~/lib/link-health/checker";
import {
  classifyByHttpStatus,
  classifyFetchError,
} from "~/lib/link-health/classifier";
import { ALWAYS_ALIVE_DOMAINS } from "~/lib/link-health/domains";
import type { BrokenStatus } from "~/lib/link-health/types";

// Build HTML programmatically to avoid closing-tag character sequences
// in this file source itself.
const LT = "<";
const SL = "/";
const GT = ">";
const block = (tag: string, inner: string = "") =>
  LT + tag + GT + inner + LT + SL + tag + GT;

function mockResponse(
  body: string | null,
  init?: ResponseInit & { url?: string },
): Response {
  const response = new Response(body, init);
  if (init?.url) {
    Object.defineProperty(response, "url", {
      value: init.url,
      configurable: true,
    });
  }
  return response;
}

describe("classifyByHttpStatus", () => {
  it("returns alive for 200 with the documented 3-field shape", () => {
    expect(classifyByHttpStatus(200)).toEqual({
      isBroken: false,
      brokenStatus: "alive",
      httpStatus: 200,
    });
  });

  it("returns alive across the 2xx range", () => {
    for (const s of [200, 201, 204, 299]) {
      expect(classifyByHttpStatus(s).brokenStatus).toBe("alive");
    }
  });

  it("returns confirmed_broken for 404", () => {
    expect(classifyByHttpStatus(404).brokenStatus).toBe("confirmed_broken");
  });

  it("returns unknown for 401 (auth-required is ambiguous)", () => {
    // A public URL returning 401 usually means bot-detection or auth-walling,
    // not that the page is actually gone — flagging it as confirmed_broken
    // produced false positives on legitimate sites.
    expect(classifyByHttpStatus(401).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(401).isBroken).toBe(false);
  });

  it("returns unknown for 403 (forbidden is ambiguous)", () => {
    expect(classifyByHttpStatus(403).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(403).isBroken).toBe(false);
  });

  it("treats 410 and 451 as confirmed_broken", () => {
    expect(classifyByHttpStatus(410).brokenStatus).toBe("confirmed_broken");
    expect(classifyByHttpStatus(451).brokenStatus).toBe("confirmed_broken");
  });

  it("returns unknown for 5xx (server-side failure is transient, not 'gone')", () => {
    // 5xx means "the server couldn't handle this request," not "the
    // resource doesn't exist." RFC 9110 §15.6 defines 503 as "will
    // likely be alleviated after some delay." A deploy blip or
    // maintenance window should show amber, not red. See design review §2 R-D.
    expect(classifyByHttpStatus(500).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(500).isBroken).toBe(false);
    expect(classifyByHttpStatus(502).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(503).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(504).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(599).brokenStatus).toBe("unknown");
  });

  it("returns unknown for transient 4xx (408/425/429)", () => {
    // 408 (Request Timeout), 425 (Too Early), 429 (Too Many Requests)
    // are all spec-explicit transient failures. The resource is fine;
    // the client/server is temporarily refusing. See design review §2 R-E.
    expect(classifyByHttpStatus(408).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(425).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(429).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(429).isBroken).toBe(false);
  });

  it("returns unknown for client/protocol 4xx (405/406/415/416/421/426/428/431)", () => {
    // These indicate the request was malformed/wrong — the resource
    // may exist if asked correctly. Not authoritative absence.
    for (const s of [405, 406, 415, 416, 421, 426, 428, 431]) {
      expect(classifyByHttpStatus(s).brokenStatus).toBe("unknown");
    }
  });

  it("returns confirmed_broken for authoritative-absence 4xx (400/404/409/412/422)", () => {
    // 404 is the canonical "not found." 400/409/412/422 indicate
    // request/resource conflict — debatable but defensible.
    for (const s of [400, 404, 409, 412, 422]) {
      expect(classifyByHttpStatus(s).brokenStatus).toBe("confirmed_broken");
    }
  });

  it("returns unknown for null and 0", () => {
    expect(classifyByHttpStatus(null).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(0).brokenStatus).toBe("unknown");
  });

  it("returns unknown for status codes outside known ranges", () => {
    expect(classifyByHttpStatus(100).brokenStatus).toBe("unknown");
    expect(classifyByHttpStatus(305).brokenStatus).toBe("unknown");
  });

  it("isBroken mirrors brokenStatus === confirmed_broken", () => {
    // 503 is now `unknown` (server-side transient), so use 404/410 for
    // the confirmed_broken cases.
    for (const s of [200, 404, 410, 503, 429]) {
      const result = classifyByHttpStatus(s);
      const expected = result.brokenStatus === "confirmed_broken";
      expect(result.isBroken).toBe(expected);
    }
  });
});

describe("classifyFetchError", () => {
  it("classifies AbortError as timeout", () => {
    const timeout = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    expect(classifyFetchError(timeout)).toMatchObject({
      brokenStatus: "unknown",
      isBroken: false,
      reason: "timeout",
      httpStatus: 0,
    });
  });

  it("classifies TypeError as network_error", () => {
    expect(classifyFetchError(new TypeError("fetch failed"))).toMatchObject({
      brokenStatus: "unknown",
      isBroken: false,
      reason: "network_error",
    });
  });

  it("classifies too-many-redirects errors", () => {
    expect(
      classifyFetchError(new Error("Too many redirects (max 5)")),
    ).toMatchObject({
      brokenStatus: "unknown",
      reason: "too_many_redirects",
    });
  });

  it("classifies redirect-loop errors", () => {
    expect(
      classifyFetchError(new Error("Redirect loop detected: a -> b")),
    ).toMatchObject({
      brokenStatus: "unknown",
      reason: "redirect_loop",
    });
  });

  it("falls back to unknown for foreign errors", () => {
    expect(
      classifyFetchError(new SyntaxError("Unexpected token")).brokenStatus,
    ).toBe("unknown");
    expect(classifyFetchError("weird non-error").brokenStatus).toBe("unknown");
  });

  it("never silently marks an error as alive", () => {
    // Regression guard: the previous version collapsed every thrown
    // fetch into is_broken=false. The only "alive" outcome must be a
    // confirmed 2xx HTTP, not an exception.
    const cases = [
      new Error("aborted"),
      Object.assign(new Error("aborted"), { name: "AbortError" }),
      new TypeError("fetch failed"),
      new Error("Too many redirects"),
      new Error("Redirect loop"),
    ];
    for (const error of cases) {
      const result = classifyFetchError(error);
      expect(result.brokenStatus).not.toBe("alive");
      expect(result.isBroken).toBe(false);
    }
  });
});

describe("detectSoft404", () => {
  it("returns false for empty body", () => {
    expect(detectSoft404("").isSoft404).toBe(false);
  });

  it("does not flag a normal long page", () => {
    const filler = "Lorem ipsum dolor sit amet. ".repeat(200);
    const body = block(
      "html",
      block("head", block("title", "My Article")) + block("body", filler),
    );
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("flags a short body with keyword + 404 title", () => {
    const titlePart = block("head", block("title", "404 - Not Found"));
    const bodyPart = block(
      "body",
      `${LT}h1${GT}Page not found${LT}${SL}h1${GT}`,
    );
    const body = block("html", titlePart + bodyPart);
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_combined");
  });

  it("does NOT flag a long article that discusses 404s in prose", () => {
    // Regression: long body + 404 keyword mentioned but title is not
    // 404-shaped must NOT trigger.
    const filler = "lorem ipsum dolor sit amet. ".repeat(1000);
    const prose = `${LT}p${GT}The article even says "page not found" colloquially${LT}${SL}p${GT}`;
    const titlePart = block("head", block("title", "The History of 404 Pages"));
    const bodyPart = block("body", filler + prose + filler);
    const body = block("html", titlePart + bodyPart);
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("matches case-insensitively in the body (combined tier)", () => {
    // The combined tier requires both a 404-shaped title AND a body
    // keyword. This test verifies the keyword match is case-insensitive.
    const titlePart = block("head", block("title", "404 - Not Found"));
    const bodyPart = block("body", "PAGE NOT FOUND — sorry about that");
    const body = block("html", titlePart + bodyPart);
    expect(detectSoft404(body).isSoft404).toBe(true);
  });

  it("does NOT flag when only the title mentions 404 (title-only branch removed)", () => {
    // The singleton title-only branch (soft404_title) was removed because
    // it was noisy and rarely correct. A title alone is no longer enough
    // — the combined tier requires both title + body keyword with a
    // short body. A long body with just a 404 title is not flagged.
    const filler = "y".repeat(8_000);
    const titlePart = block("head", block("title", "404 Not Found"));
    const bodyPart = block("body", filler);
    const body = block("html", titlePart + bodyPart);
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("does NOT flag a long article that discusses 404s in prose", () => {
    // Regression: long body + 404 keyword mentioned but title is not
    // 404-shaped must NOT trigger. The combined tier needs both signals
    // plus a short body.
    const filler = "lorem ipsum dolor sit amet. ".repeat(1000);
    const prose = `${LT}p${GT}The article even says "page not found" colloquially${LT}${SL}p${GT}`;
    const titlePart = block("head", block("title", "The History of 404 Pages"));
    const bodyPart = block("body", filler + prose + filler);
    const body = block("html", titlePart + bodyPart);
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("flags a large soft-404 page with canonical → /404 (tier-1 fires regardless of size)", () => {
    // Regression for the new tier design: high-precision signals fire
    // on large CMS 404 pages too. The old 4 KB gate killed these.
    const filler = "y".repeat(8_000);
    const link = `${LT}link rel="canonical" href="https://example.com/404.html"${GT + SL}`;
    const body = block("html", block("head", link) + block("body", filler));
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_canonical");
  });

  it("flags a large soft-404 page with error-page CSS class (tier-1)", () => {
    // The error-page CSS class is a tier-1 signal — fires regardless of
    // body size. A real article almost never has class="error-page".
    const filler = "y".repeat(6_000);
    const body = `${LT}div class="error-page"${GT}oops${LT}${SL}div${GT}${filler}`;
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_error_class");
  });

  it("does NOT flag error-page class when body is extremely large (>64 KB)", () => {
    // The negative signal: a very large body is a real article. No 404
    // page is this big. This suppresses all soft-404 signals.
    const filler = "y".repeat(70_000);
    const body = `${LT}div class="error-page"${GT}oops${LT}${SL}div${GT}${filler}`;
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("flags short body with error-page CSS class", () => {
    const body = `${LT}div class="error-page"${GT}${LT}h1${GT}Sorry${LT}${SL}h1${GT}${LT}${SL}div${GT}`;
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_error_class");
  });

  it("flags short body with page-404 CSS class", () => {
    const body = `${LT}body class="page-404 container"${GT}oops${LT}${SL}body${GT}`;
    expect(detectSoft404(body).isSoft404).toBe(true);
  });

  it("flags short body with canonical URL pointing to /404", () => {
    const link = `${LT}link rel="canonical" href="https://example.com/404.html"${GT + SL}`;
    const body = block("html", block("head", link) + block("body", "oops"));
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_canonical");
  });

  it("flags short body with canonical URL pointing to /not-found", () => {
    const link = `${LT}link rel="canonical" href="https://example.com/not-found/"${GT + SL}`;
    const body = block("html", block("head", link) + block("body", "oops"));
    expect(detectSoft404(body).isSoft404).toBe(true);
  });

  it("does NOT flag a canonical URL pointing at a real page", () => {
    const link = `${LT}link rel="canonical" href="https://example.com/blog/my-post"${GT + SL}`;
    const body = block("html", block("head", link) + block("body", "real"));
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("flags short JSON body with a 404 error payload", () => {
    const body = JSON.stringify({ error: "not found" });
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_json_error");
  });

  it("flags short JSON body with code: 404", () => {
    const body = JSON.stringify({ code: 404 });
    expect(detectSoft404(body).isSoft404).toBe(true);
  });

  it("does NOT flag a JSON body that is a valid response", () => {
    const body = JSON.stringify({ data: { id: 1, title: "real" } });
    expect(detectSoft404(body).isSoft404).toBe(false);
  });

  it("flags a large JSON body with error payload (tier-1 fires regardless of size)", () => {
    // JSON error payloads are tier-1 — the old short-body gate killed
    // these, but a real API returning {"error":"not found"} with a
    // large debug field is still a soft-404.
    const body = JSON.stringify({
      error: "not found",
      debug: "y".repeat(8_000),
    });
    const result = detectSoft404(body);
    expect(result.isSoft404).toBe(true);
    expect(result.reason).toBe("soft404_json_error");
  });

  it("does NOT flag an effectively-empty body (empty-body heuristic removed as too FP-prone)", () => {
    // The <200 byte empty-body heuristic was removed — it produced FPs
    // on legitimate short responses (minimal HTML, small JSON, "ok"
    // confirmation bodies). A short body alone is not a soft-404 signal.
    expect(detectSoft404("ok").isSoft404).toBe(false);
    expect(detectSoft404("404").isSoft404).toBe(false);
  });

  it("does NOT flag a moderate-length body with no soft-404 signals", () => {
    const body = block(
      "html",
      block("head", block("title", "My Page")) +
        block("body", "A short but real page with enough content."),
    );
    expect(detectSoft404(body).isSoft404).toBe(false);
  });
});

// Compile-time + runtime exhaustiveness check.
describe("BrokenStatus type exhaustiveness", () => {
  it("has the expected set of values (no manual_override)", () => {
    // manual_override was removed — the override lifecycle was buggy
    // (cron never expired overrides) and the feature created friction
    // without improving detection. See docs/adr/0002-remove-manual-override.md.
    const all: BrokenStatus[] = [
      "alive",
      "confirmed_broken",
      "likely_broken",
      "unknown",
    ];
    expect(all).toHaveLength(4);
    expect(all).not.toContain("manual_override");
  });
});

describe("ALWAYS_ALIVE_DOMAINS", () => {
  it("contains expected high-noise domains", () => {
    expect(ALWAYS_ALIVE_DOMAINS).toContain("twitter.com");
    expect(ALWAYS_ALIVE_DOMAINS).toContain("x.com");
    expect(ALWAYS_ALIVE_DOMAINS).toContain("youtube.com");
    expect(ALWAYS_ALIVE_DOMAINS).toContain("instagram.com");
  });

  it("does not contain generic domains", () => {
    expect(ALWAYS_ALIVE_DOMAINS).not.toContain("example.com");
    expect(ALWAYS_ALIVE_DOMAINS).not.toContain("google.com");
  });
});

// ---------------------------------------------------------------------------
// One checkUrl fallback scenario not covered by link-health-e2e.test.ts:
// the HEAD 403 → GET 200 success path (reason ok_get).
// ---------------------------------------------------------------------------

describe("checkUrl fallback", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back to GET on HEAD 403 and classifies the GET result", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(null, { status: 403 }))
      .mockResolvedValueOnce(mockResponse("y".repeat(10_000), { status: 200 }))
      .mockResolvedValueOnce(mockResponse("y".repeat(10_000), { status: 200 }));

    const result = await checkUrl("https://example.com/behind-bot-wall");
    expect(fetchSpy).toHaveBeenCalledTimes(3); // HEAD + GET fallback + soft-404 probe
    expect(result.brokenStatus).toBe("alive");
    expect(result.reason).toBe("ok_get");
  });
});
