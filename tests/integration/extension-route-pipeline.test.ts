import { describe, expect, it, mock } from "bun:test";
import { z } from "zod";

import { withExtension } from "~/app/api/extension/_lib/with-extension";

function makeSupabase({ user }: { user: { id: string } | null }) {
  return {
    auth: {
      getUser: mock(async () => ({
        data: { user },
        error: user ? null : { message: "no session" },
      })),
    },
  };
}

// SAFETY: assertions read known fields off this repo's own route responses.
const json = <T>(res: Response) => res.json() as Promise<T>;

describe("withExtension pipeline", () => {
  it("returns a consistent 400 shape for an invalid payload", async () => {
    const handler = mock(async () => Response.json({ ok: true }));
    const POST = withExtension(
      {
        scope: "test",
        bodySchema: z.object({ url: z.url() }),
      },
      handler,
      async () => makeSupabase({ user: { id: "u1" } }),
    );

    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ url: 42 }),
      }),
    );

    expect(res.status).toBe(400);
    expect(await json<{ error: string }>(res)).toEqual({
      error: "Invalid request",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns a consistent 400 shape for unparseable JSON", async () => {
    const handler = mock(async () => Response.json({ ok: true }));
    const POST = withExtension(
      { scope: "test", bodySchema: z.object({}) },
      handler,
      async () => makeSupabase({ user: { id: "u1" } }),
    );

    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: "not json" }),
    );

    expect(res.status).toBe(400);
    const body = await json<{ error: string }>(res);
    expect(body.error.length).toBeGreaterThan(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns the default 401 for unauthorized requests", async () => {
    const handler = mock(async () => Response.json({ ok: true }));
    const GET = withExtension({ scope: "test" }, handler, async () =>
      makeSupabase({ user: null }),
    );

    const res = await GET(new Request("http://localhost/"));

    expect(res.status).toBe(401);
    expect(await json<{ error: string }>(res)).toEqual({
      error: "Unauthorized",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("uses the route's graceful response when unauthorized is customized", async () => {
    const GET = withExtension(
      {
        scope: "test",
        unauthorized: () =>
          Response.json({ authenticated: false, items: [] }, { status: 200 }),
      },
      async () => {
        throw new Error("never reached");
      },
      async () => makeSupabase({ user: null }),
    );

    const res = await GET(new Request("http://localhost/"));

    expect(res.status).toBe(200);
    expect(
      await json<{ authenticated: boolean; items: string[] }>(res),
    ).toEqual({ authenticated: false, items: [] });
  });

  it("normalizes thrown handler errors into a sanitized 500", async () => {
    const POST = withExtension(
      { scope: "bookmark save", failureMessage: "Failed to save bookmark" },
      async () => {
        throw new Error("duplicate key value violates unique constraint");
      },
      async () => makeSupabase({ user: { id: "u1" } }),
    );

    const res = await POST(
      new Request("http://localhost/", { method: "POST" }),
    );

    expect(res.status).toBe(500);
    expect(await json<{ error: string }>(res)).toEqual({
      error: "Failed to save bookmark",
    });
  });

  it("lets routes degrade gracefully via onUnexpected instead of 500", async () => {
    const GET = withExtension(
      {
        scope: "check",
        onUnexpected: () => Response.json({ saved: false }, { status: 200 }),
      },
      async () => {
        throw new Error("ECONNREFUSED");
      },
      async () => makeSupabase({ user: { id: "u1" } }),
    );

    const res = await GET(new Request("http://localhost/"));

    expect(res.status).toBe(200);
    expect(await json<{ saved: boolean }>(res)).toEqual({ saved: false });
  });

  it("passes the validated body and authenticated user to the handler", async () => {
    const seen: Array<{ id: string; url: string }> = [];
    const POST = withExtension(
      { scope: "test", bodySchema: z.object({ url: z.string() }) },
      async ({ user, body }) => {
        seen.push({ id: user.id, url: body.url });
        return Response.json({ ok: true });
      },
      async () => makeSupabase({ user: { id: "u1" } }),
    );

    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );

    expect(seen).toEqual([{ id: "u1", url: "https://example.com" }]);
    expect((await json<{ ok: boolean }>(res)).ok).toBe(true);
  });
});
