/**
 * Integration / E2E tests for the link-health state machine.
 *
 * These exercise the full `checkUrl` orchestrator (with mocked fetch)
 * against the documented decision tree in
 * docs/broken-link-detection-audit.md §2 and the design review
 * docs/broken-link-detection-design-review.md §3.
 *
 * Each test maps to a scenario-matrix case. Together they verify that
 * the classifier produces the right BrokenStatus + reason for every
 * documented input class: 2xx, 3xx, 4xx, 5xx, network errors, redirects,
 * soft-404s, login walls, and always-alive domains.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkUrl } from "~/lib/link-health/checker";

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

function _mockRedirect(location: string, status: number = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe("checkUrl — state machine E2E", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // §3.1 — Success path (2xx)
  // ---------------------------------------------------------------------------

  describe("2xx responses", () => {
    it("alive on HEAD 200 with a long, non-soft-404 body", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(
          mockResponse("y".repeat(10_000), {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        );

      const result = await checkUrl("https://example.com/post");
      expect(result.brokenStatus).toBe("alive");
      expect(result.httpStatus).toBe(200);
      expect(result.reason).toBe("ok");
    });

    it("likely_broken on HEAD 200 + soft-404 (title + keyword)", async () => {
      const soft404Body = block(
        "html",
        block("head", block("title", "404 - Not Found")) +
          block("body", "Page not found"),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(mockResponse(soft404Body, { status: 200 }));

      const result = await checkUrl("https://example.com/missing");
      expect(result.brokenStatus).toBe("likely_broken");
      expect(result.isBroken).toBe(true);
      expect(result.reason).toBe("soft404_combined");
    });

    it("likely_broken on 200 + large soft-404 with canonical → /404 (tier-1)", async () => {
      // Regression: the old 4KB gate killed this. The new tier-1 design
      // fires canonical regardless of body size.
      const filler = "y".repeat(8_000);
      const link = `${LT}link rel="canonical" href="https://example.com/404.html"${GT + SL}`;
      const soft404Body = block(
        "html",
        block("head", link) + block("body", filler),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(mockResponse(soft404Body, { status: 200 }));

      const result = await checkUrl("https://example.com/cms-404");
      expect(result.brokenStatus).toBe("likely_broken");
      expect(result.reason).toBe("soft404_canonical");
    });

    it("likely_broken on 200 + error-page CSS class (tier-1)", async () => {
      const soft404Body = `${LT}div class="error-page"${GT}Oops${LT}${SL}div${GT}`;

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(mockResponse(soft404Body, { status: 200 }));

      const result = await checkUrl("https://example.com/error-page");
      expect(result.brokenStatus).toBe("likely_broken");
      expect(result.reason).toBe("soft404_error_class");
    });

    it("likely_broken on 200 + JSON error payload", async () => {
      const jsonBody = JSON.stringify({ error: "not found" });

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(
          mockResponse(jsonBody, {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );

      const result = await checkUrl("https://api.example.com/resource");
      expect(result.brokenStatus).toBe("likely_broken");
      expect(result.reason).toBe("soft404_json_error");
    });

    it("alive on 200 with a long article discussing 404s (no FP)", async () => {
      // Regression: the article title is "The History of 404 Pages" and
      // the body mentions "page not found" — but the title is not
      // 404-shaped (no "404" in it, not "not found"), and the body is
      // long (>8KB), so the combined tier doesn't fire.
      const filler = "lorem ipsum dolor sit amet. ".repeat(1000);
      const prose = `${LT}p${GT}The article says "page not found" colloquially${LT}${SL}p${GT}`;
      const body = block(
        "html",
        block("head", block("title", "The History of 404 Pages")) +
          block("body", filler + prose + filler),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(mockResponse(body, { status: 200 }));

      const result = await checkUrl("https://blog.example.com/404-history");
      expect(result.brokenStatus).toBe("alive");
    });
  });

  // ---------------------------------------------------------------------------
  // §3.2 — Redirects (3xx)
  // ---------------------------------------------------------------------------

  describe("redirects", () => {
    it("alive on 301 → 200 final (auto-followed)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("y".repeat(10_000), {
          status: 200,
          url: "https://example.com/final",
        }),
      );

      const result = await checkUrl("https://example.com/old");
      expect(result.brokenStatus).toBe("alive");
    });

    it("confirmed_broken on 301 → 404 final (redirect to gone page)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse(null, { status: 404, url: "https://example.com/gone" }),
      );

      const result = await checkUrl("https://example.com/redirects-to-gone");
      expect(result.brokenStatus).toBe("confirmed_broken");
      expect(result.httpStatus).toBe(404);
    });

    it("unknown on too many redirects (redirect loop)", async () => {
      // Under native auto-follow, a redirect loop surfaces as a fetch
      // error. classifyFetchError inspects the message and routes
      // "Redirect loop" to reason='redirect_loop'.
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Redirect loop detected: a -> b -> a"),
      );

      const result = await checkUrl("https://example.com/loop");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("redirect_loop");
    });
  });

  // ---------------------------------------------------------------------------
  // §3.3 — Client errors (4xx)
  // ---------------------------------------------------------------------------

  describe("4xx responses", () => {
    it("confirmed_broken on HEAD 404", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse(null, { status: 404 }),
      );

      const result = await checkUrl("https://example.com/not-found");
      expect(result.brokenStatus).toBe("confirmed_broken");
      expect(result.httpStatus).toBe(404);
      expect(result.reason).toBe("client_error");
    });

    it("confirmed_broken with reason=gone on HEAD 410", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse(null, { status: 410 }),
      );

      const result = await checkUrl("https://example.com/deleted");
      expect(result.brokenStatus).toBe("confirmed_broken");
      expect(result.reason).toBe("gone");
    });

    it("confirmed_broken on HEAD 451 (legal block)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse(null, { status: 451 }),
      );

      const result = await checkUrl("https://example.com/legal");
      expect(result.brokenStatus).toBe("confirmed_broken");
      expect(result.reason).toBe("gone");
    });

    it("unknown on HEAD 401 (auth-required is ambiguous)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse(null, { status: 401 }),
      );

      const result = await checkUrl("https://example.com/protected");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.isBroken).toBe(false);
      expect(result.httpStatus).toBe(401);
      expect(result.reason).toBe("auth_required");
    });

    it("unknown on HEAD 429 (rate-limited, not broken)", async () => {
      // 429 is retried by httpFetch; after exhaustion it's classified
      // as unknown, not confirmed_broken.
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("too many requests", { status: 429 }),
      );

      const result = await checkUrl("https://example.com/rate-limited");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.isBroken).toBe(false);
      expect(result.reason).toBe("rate_limited");
    });

    it("unknown on HEAD 408 (request timeout is transient)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse(null, { status: 408 }),
      );

      const result = await checkUrl("https://example.com/slow-client");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("transient");
    });

    it("alive on HEAD 405 → GET fallback returns 200", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 405 }))
        .mockResolvedValueOnce(
          mockResponse("y".repeat(10_000), { status: 200 }),
        )
        .mockResolvedValueOnce(
          mockResponse("y".repeat(10_000), { status: 200 }),
        );

      const result = await checkUrl("https://example.com/no-head");
      expect(result.brokenStatus).toBe("alive");
      expect(result.reason).toBe("ok_get");
    });

    it("unknown on HEAD 403 → GET fallback also 403 (bot-walled)", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 403 }))
        .mockResolvedValueOnce(mockResponse(null, { status: 403 }));

      const result = await checkUrl("https://example.com/bot-walled");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.httpStatus).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // §3.4 — Server errors (5xx)
  // ---------------------------------------------------------------------------

  describe("5xx responses", () => {
    it("unknown on HEAD 500 (server error is transient)", async () => {
      // mockResolvedValue (not Once) because httpFetch retries on 500.
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("error", { status: 500 }),
      );

      const result = await checkUrl("https://example.com/down");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.isBroken).toBe(false);
      expect(result.reason).toBe("server_error");
    });

    it("unknown on HEAD 503 (maintenance window is spec-explicit transient)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("maintenance", { status: 503 }),
      );

      const result = await checkUrl("https://example.com/maintenance");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("server_error");
    });

    it("unknown on HEAD 504 (gateway timeout — now retried, then unknown)", async () => {
      // 504 was previously NOT retried and went straight to
      // confirmed_broken. Now it's in DEFAULT_RETRY_STATUSES and
      // classified as unknown after retry exhaustion.
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("gateway timeout", { status: 504 }),
      );

      const result = await checkUrl("https://example.com/gateway");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("server_error");
    });
  });

  // ---------------------------------------------------------------------------
  // §3.5 — Network errors
  // ---------------------------------------------------------------------------

  describe("network errors", () => {
    it("unknown on timeout (AbortError)", async () => {
      const abortError = Object.assign(new Error("aborted"), {
        name: "AbortError",
      });
      vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError);

      const result = await checkUrl("https://example.com/slow");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("timeout");
      expect(result.isBroken).toBe(false);
    });

    it("unknown on DNS failure (TypeError)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("fetch failed: ENOTFOUND"),
      );

      const result = await checkUrl("https://nonexistent.invalid");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("network_error");
    });

    it("unknown on TLS failure (TypeError)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("fetch failed: certificate has expired"),
      );

      const result = await checkUrl("https://expired-cert.example.com");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("network_error");
    });

    it("unknown on connection refused (TypeError)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("fetch failed: ECONNREFUSED"),
      );

      const result = await checkUrl("https://localhost:9999");
      expect(result.brokenStatus).toBe("unknown");
      expect(result.reason).toBe("network_error");
    });
  });

  // ---------------------------------------------------------------------------
  // §3.6 — Always-alive domains
  // ---------------------------------------------------------------------------

  describe("always-alive domains", () => {
    it("alive (no fetch) for twitter.com", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await checkUrl("https://twitter.com/user/status/123");
      expect(result.brokenStatus).toBe("alive");
      expect(result.reason).toBe("always_alive");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("alive (no fetch) for subdomain of always-alive (api.twitter.com)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await checkUrl("https://api.twitter.com/2/tweets");
      expect(result.brokenStatus).toBe("alive");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("alive (no fetch) for youtube.com", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await checkUrl("https://youtube.com/watch?v=abc");
      expect(result.brokenStatus).toBe("alive");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetches normally when always-alive domain is only a path segment", async () => {
      // Regression: https://evil.com/twitter.com must NOT short-circuit.
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("y".repeat(10_000), {
          status: 200,
          url: "https://evil.com/twitter.com",
        }),
      );

      const result = await checkUrl("https://evil.com/twitter.com");
      expect(fetchSpy).toHaveBeenCalled();
      expect(result.brokenStatus).toBe("alive");
    });
  });

  // ---------------------------------------------------------------------------
  // §3.7 — Login walls / interstitials
  // ---------------------------------------------------------------------------

  describe("login walls and interstitials", () => {
    it("alive on 200 login wall (not broken — resource exists, just auth-gated)", async () => {
      // A 200 with <title>Sign in</title> is a login interstitial.
      // It's alive — the resource exists, access requires auth.
      const loginBody = block(
        "html",
        block("head", block("title", "Sign in - Example App")) +
          block("body", `${LT}form${GT}Username: ...${LT}${SL}form${GT}`),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(mockResponse(loginBody, { status: 200 }));

      const result = await checkUrl("https://app.example.com/dashboard");
      expect(result.brokenStatus).toBe("alive");
    });

    it("alive on 200 Cloudflare challenge page (not broken)", async () => {
      // A Cloudflare "Just a moment..." interstitial returns 200 with
      // a JS challenge. It's alive — the resource exists, the check is
      // just bot-blocked.
      const challengeBody = block(
        "html",
        block("head", block("title", "Just a moment...")) +
          block("body", "Checking your browser..."),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(null, { status: 200 }))
        .mockResolvedValueOnce(mockResponse(challengeBody, { status: 200 }));

      const result = await checkUrl("https://protected.example.com/page");
      expect(result.brokenStatus).toBe("alive");
    });
  });

  // Error-safety regression guard lives in link-health.test.ts
  // ("never silently marks an error as alive") — not duplicated here
  // to avoid the retry-backoff timeout that the loop variant hits.
});
