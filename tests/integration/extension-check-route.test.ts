import type { NextRequest } from "next/server";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from "bun:test";
import { NextRequest as NextRequestImpl } from "next/server";

const createClientMock = mock();

mock.module("~/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

interface QueriedColumns {
  url: string | null;
  workspaceId: string | null;
}

function makeSupabase({
  user,
  storedUrl,
}: {
  user: { id: string } | null;
  storedUrl: string | null;
}) {
  // Capture the URL the route actually queried with so the test can assert
  // it was the normalized form (not the raw tab URL).
  const queried: QueriedColumns = {
    url: null,
    workspaceId: null,
  };
  const eqBuilder = {
    eq: (col: string, value: string) => {
      if (col === "url") queried.url = value;
      if (col === "workspace_id") queried.workspaceId = value;
      return eqBuilder;
    },
    maybeSingle: mock(async () => ({
      data: storedUrl
        ? { id: "bm-1", url: storedUrl, workspace_id: queried.workspaceId }
        : null,
      error: null,
    })),
  };
  const bookmarks = {
    select: () => eqBuilder,
  };
  return {
    auth: {
      getUser: mock(async () => ({
        data: { user },
        error: user ? null : { message: "no user" },
      })),
    },
    from: (table: string) => (table === "bookmarks" ? bookmarks : null),
    queried,
  };
}

beforeEach(() => {
  createClientMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  mock.restore();
});

const { GET } = await import("~/app/api/extension/check/route");

function makeRequest(url: string): NextRequest {
  return new NextRequestImpl(url, { method: "GET" });
}

describe("GET /api/extension/check — normalizeUrl fix", () => {
  it("queries with the normalized URL, not the raw tab URL", async () => {
    const supabase = makeSupabase({
      user: { id: "u1" },
      storedUrl: "https://example.com/page",
    });
    createClientMock.mockResolvedValue(supabase);

    const req = makeRequest(
      "http://test/api/extension/check?url=" +
        encodeURIComponent(
          "https://www.example.com/page?utm_source=x&ref=y#frag",
        ) +
        "&workspace_id=550e8400-e29b-41d4-a716-446655440000",
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(supabase.queried.url).toBe("https://example.com/page?ref=y");
    expect(supabase.queried.workspaceId).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(json).toEqual({
      saved: true,
      bookmark_id: "bm-1",
    });
  });

  it("returns saved=false when no row matches the normalized URL", async () => {
    const supabase = makeSupabase({
      user: { id: "u1" },
      storedUrl: null,
    });
    createClientMock.mockResolvedValue(supabase);

    const req = makeRequest(
      "http://test/api/extension/check?url=" +
        encodeURIComponent("https://Example.com/PAGE/") +
        "&workspace_id=550e8400-e29b-41d4-a716-446655440000",
    );
    const res = await GET(req);
    const json = await res.json();
    expect(json.saved).toBe(false);
    expect(supabase.queried.url).toBe("https://example.com/PAGE");
  });
});
