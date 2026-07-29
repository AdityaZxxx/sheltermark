import { beforeEach, describe, expect, it, jest, mock, spyOn } from "bun:test";

import { httpFetch, readResponseBody } from "~/lib/utils/http-fetch";

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

function mockRedirectResponse(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("httpFetch", () => {
  describe("basic GET", () => {
    it("returns response, finalUrl, and duration", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("ok", { status: 200, url: "https://example.com" }),
      );

      const result = await httpFetch("https://example.com");

      expect(result.response).toBeDefined();
      expect(result.finalUrl).toBe("https://example.com");
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(await result.response.text()).toBe("ok");
    });

    it("sets default headers including User-Agent", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("ok", { status: 200 }),
      );

      await httpFetch("https://example.com");

      // SAFETY: httpFetch always forwards a plain RequestInit as fetch's
      // second argument, and builds headers as a plain object.
      const callArgs = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      // SAFETY: same invariant as above — headers built as a plain object.
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["User-Agent"]).toBe("Sheltermark/1.0");
    });
  });

  describe("retries", () => {
    it("retries on 5xx status codes and returns on success", async () => {
      const fetchSpy = spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse("error", { status: 500 }))
        .mockResolvedValueOnce(mockResponse("error", { status: 502 }))
        .mockResolvedValueOnce(
          mockResponse("ok", { status: 200, url: "https://example.com" }),
        );

      const result = await httpFetch("https://example.com", { retries: 3 });

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(await result.response.text()).toBe("ok");
    });

    it("retries on 429 status", async () => {
      const fetchSpy = spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          mockResponse("too many requests", { status: 429 }),
        )
        .mockResolvedValueOnce(
          mockResponse("ok", { status: 200, url: "https://example.com" }),
        );

      const result = await httpFetch("https://example.com");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(await result.response.text()).toBe("ok");
    });

    it("retries on network errors (AbortError)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      const fetchSpy = spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(
          mockResponse("ok", { status: 200, url: "https://example.com" }),
        );

      const result = await httpFetch("https://example.com");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(await result.response.text()).toBe("ok");
    });

    it("does NOT retry non-retryable errors (e.g. ReferenceError)", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
        new ReferenceError("x is not defined"),
      );

      await expect(httpFetch("https://example.com")).rejects.toThrow(
        "x is not defined",
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry non-retryable errors (SyntaxError)", async () => {
      const fetchSpy = spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
        .mockResolvedValueOnce(
          mockResponse("ok", { status: 200, url: "https://example.com" }),
        );

      await expect(httpFetch("https://example.com")).rejects.toThrow(
        "Unexpected token",
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries TypeError (network-level failures)", async () => {
      const fetchSpy = spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(
          mockResponse("ok", { status: 200, url: "https://example.com" }),
        );

      const result = await httpFetch("https://example.com");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(await result.response.text()).toBe("ok");
    });

    it("stops retrying when external signal fires during sleep", async () => {
      const controller = new AbortController();
      const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("fetch failed"),
      );

      setTimeout(() => controller.abort(), 5);

      await expect(
        httpFetch("https://example.com", {
          retries: 5,
          signal: controller.signal,
        }),
      ).rejects.toThrow("The operation was aborted");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("honors Retry-After header on 429 responses", async () => {
      jest.useFakeTimers();
      const fetchSpy = spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response("too many requests", {
            status: 429,
            headers: { "retry-after": "1" },
          }),
        )
        .mockResolvedValueOnce(
          mockResponse("ok", { status: 200, url: "https://example.com" }),
        );

      const resultPromise = httpFetch("https://example.com");

      // Bun has no vi.advanceTimersByTimeAsync (advance + interleaved
      // microtask flush). The mocked first fetch settles only in microtasks,
      // so flush once to let the 429 path register its backoff timer, advance
      // the fake clock past it, then flush again so the retry settles.
      // setImmediate is not timer-faked by Bun, so it drains the microtask
      // queue.
      await new Promise((resolve) => setImmediate(resolve));
      jest.advanceTimersByTime(1500);
      await new Promise((resolve) => setImmediate(resolve));

      const result = await resultPromise;
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(await result.response.text()).toBe("ok");

      jest.useRealTimers();
    });

    it("returns last response after exhausting retries", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("server error", { status: 500 }),
      );

      const result = await httpFetch("https://example.com", { retries: 1 });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.response.ok).toBe(false);
      expect(result.response.status).toBe(500);
    });
  });

  describe("redirect handling", () => {
    it("follows redirects automatically (default)", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("final", { status: 200, url: "https://example.com" }),
      );

      const result = await httpFetch("https://example.com");

      expect(result.finalUrl).toBe("https://example.com");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does not follow redirects when followRedirect=false", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockRedirectResponse("https://other.com", 302),
      );

      const result = await httpFetch("https://example.com", {
        followRedirect: false,
      });

      expect(result.finalUrl).toBe("https://example.com");
      expect(result.response.status).toBe(302);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("follows redirects manually and calls onRedirectHop", async () => {
      const fetchSpy = spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          mockRedirectResponse("https://other.com/page", 302),
        )
        .mockResolvedValueOnce(
          mockResponse("final", { status: 200, url: "https://other.com/page" }),
        );

      const onRedirectHop = mock().mockResolvedValue(true);

      const result = await httpFetch("https://example.com", {
        followRedirect: { maxHops: 5 },
        onRedirectHop,
      });

      expect(result.finalUrl).toBe("https://other.com/page");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(onRedirectHop).toHaveBeenCalledWith("https://other.com/page");
      expect(await result.response.text()).toBe("final");
    });

    it("detects redirect loops (A -> B -> A)", async () => {
      spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockRedirectResponse("https://b.com", 302))
        .mockResolvedValueOnce(mockRedirectResponse("https://a.com", 302));

      await expect(
        httpFetch("https://a.com", {
          followRedirect: { maxHops: 5 },
        }),
      ).rejects.toThrow("Redirect loop detected");
    });

    it("blocks redirect when onRedirectHop returns false", async () => {
      spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockRedirectResponse("https://malicious.com", 302),
      );

      const onRedirectHop = mock().mockResolvedValue(false);

      await expect(
        httpFetch("https://example.com", {
          followRedirect: { maxHops: 5 },
          onRedirectHop,
        }),
      ).rejects.toThrow("Redirect to unsafe URL blocked");

      expect(onRedirectHop).toHaveBeenCalledWith("https://malicious.com/");
    });
  });

  describe("HTTP methods", () => {
    it("supports HEAD method", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse(null, {
          status: 200,
          headers: { "content-type": "image/x-icon" },
        }),
      );

      const { response } = await httpFetch("https://example.com/favicon.ico", {
        method: "HEAD",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/x-icon");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      // SAFETY: see above — plain RequestInit argument after mock.calls[0].
      const callArgs = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      expect(callArgs.method).toBe("HEAD");
    });
  });

  describe("external abort signal", () => {
    it("aborts and stops retrying when external signal fires", async () => {
      const controller = new AbortController();
      const abortAwareFetch = async (
        _url: URL | RequestInfo,
        options?: RequestInit,
      ) => {
        // SAFETY: narrowing assert — RequestInit's optional `signal` made
        // non-optional for the abort check; no type evidence lost.
        const opts = options as
          | (RequestInit & { signal: AbortSignal })
          | undefined;
        if (opts?.signal?.aborted) {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          throw err;
        }
        return mockResponse("ok", { status: 200 });
      };
      // SAFETY: Bun's typeof fetch carries static extras (preconnect); the
      // mock satisfies the call signature, which is all the spy uses.
      const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
        abortAwareFetch as typeof globalThis.fetch,
      );

      controller.abort();

      await expect(
        httpFetch("https://example.com", {
          retries: 3,
          signal: controller.signal,
        }),
      ).rejects.toThrow("The operation was aborted");

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("custom options", () => {
    it("accepts custom headers and user-agent", async () => {
      const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        mockResponse("ok", { status: 200 }),
      );

      await httpFetch("https://example.com", {
        userAgent: "CustomBot/1.0",
        headers: { Accept: "application/json" },
      });

      // SAFETY: see above — plain RequestInit + plain object headers.
      const callArgs = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      // SAFETY: same invariant — headers built as a plain object.
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["User-Agent"]).toBe("CustomBot/1.0");
      expect(headers.Accept).toBe("application/json");
    });
  });
});

describe("readResponseBody", () => {
  it("returns full body when no maxBytes", async () => {
    const response = new Response("hello world");
    const body = await readResponseBody(response);
    expect(body).toBe("hello world");
  });

  it("truncates body when maxBytes is set", async () => {
    const response = new Response("hello world this is a longer text");
    const body = await readResponseBody(response, 11);
    expect(body).toBe("hello world");
  });

  it("returns full body when content is under maxBytes", async () => {
    const response = new Response("short text");
    const body = await readResponseBody(response, 100);
    expect(body).toBe("short text");
  });

  it("returns empty string for null body", async () => {
    const response = new Response("");
    const body = await readResponseBody(response, 100);
    expect(body).toBe("");
  });
});
