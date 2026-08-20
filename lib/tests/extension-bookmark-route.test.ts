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

// Mock the repository layer so the route is exercised against a controlled
// insertBookmark implementation. The repository itself is covered by
// bookmark-repository.test.ts; this file verifies the route's request
// validation, response shape, and status-code behavior.
const insertBookmarkMock = mock();

mock.module("~/lib/data/repositories/bookmark.repository", () => ({
  insertBookmark: (...args: unknown[]) => insertBookmarkMock(...args),
}));

const createClientMock = mock();

mock.module("~/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

let defaultWorkspaceId: string | null = null;

mock.module("~/lib/data/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              defaultWorkspaceId ? [{ id: defaultWorkspaceId }] : [],
            ),
        }),
      }),
    }),
  }),
}));

// Supabase client fixture used by the route for auth only.
function makeSupabase({ user }: { user: { id: string } | null }) {
  const auth = {
    getUser: mock(async () => ({
      data: { user },
      error: user ? null : { message: "no user" },
    })),
  };
  return { auth };
}

beforeEach(() => {
  insertBookmarkMock.mockReset();
  createClientMock.mockReset();
  defaultWorkspaceId = "ws-default";
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  mock.restore();
});

// Import after mocks are wired.
const { POST } = await import("~/app/api/extension/bookmark/route");

type JsonRequestBody = {
  readonly [key: string]: string | string[] | undefined;
};

function makeRequest(body: JsonRequestBody): Request {
  return new Request("http://test/api/extension/bookmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extension/bookmark", () => {
  it("returns 401 when not authenticated", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: null }));
    const res = await POST(makeRequest({ url: "https://example.com" }));
    expect(res.status).toBe(401);
    expect(insertBookmarkMock).not.toHaveBeenCalled();
  });

  it("returns 400 when url is missing or invalid", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    const r1 = await POST(makeRequest({}));
    expect(r1.status).toBe(400);
    const r2 = await POST(makeRequest({ url: "not a url" }));
    expect(r2.status).toBe(400);
    expect(insertBookmarkMock).not.toHaveBeenCalled();
  });

  it("returns 400 when url protocol is not http/https", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    const res = await POST(makeRequest({ url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(insertBookmarkMock).not.toHaveBeenCalled();
  });

  it("returns 400 when tags exceed 50 or name exceeds 50 chars", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    const tooMany = Array.from({ length: 51 }, (_, i) => `tag${i}`);
    const r1 = await POST(
      makeRequest({ url: "https://example.com", tags: tooMany }),
    );
    expect(r1.status).toBe(400);

    const r2 = await POST(
      makeRequest({
        url: "https://example.com",
        tags: ["x".repeat(51)],
      }),
    );
    expect(r2.status).toBe(400);
    expect(insertBookmarkMock).not.toHaveBeenCalled();
  });

  it("returns 400 when no workspace provided and no default exists", async () => {
    defaultWorkspaceId = null;
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    const res = await POST(makeRequest({ url: "https://example.com" }));
    expect(res.status).toBe(400);
    expect(insertBookmarkMock).not.toHaveBeenCalled();
  });

  it("returns 200 with data.tags and forwards clientTitle + tagNames to insertBookmark", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    insertBookmarkMock.mockResolvedValue({
      success: true,
      data: {
        id: "bm-1",
        user_id: "u1",
        workspace_id: "ws-1",
        url: "https://example.com/post",
        title: "Custom",
        favicon_url: null,
        og_image_url: null,
        is_public: false,
        is_broken: false,
        broken_status: "alive",
        http_status: null,
        last_checked_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
        deleted_at: null,
        note: null,
      },
      tags: [
        {
          id: "t1",
          user_id: "u1",
          name: "dev",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const res = await POST(
      makeRequest({
        url: "https://example.com/post",
        workspace_id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Custom",
        tags: ["dev"],
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.tags).toEqual([
      {
        id: "t1",
        user_id: "u1",
        name: "dev",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    expect(insertBookmarkMock).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({
        url: "https://example.com/post",
        workspaceId: "550e8400-e29b-41d4-a716-446655440000",
        clientTitle: "Custom",
        tagNames: ["dev"],
      }),
    );
  });

  it("falls back to default workspace when workspace_id omitted", async () => {
    defaultWorkspaceId = "550e8400-e29b-41d4-a716-446655440001";
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    insertBookmarkMock.mockResolvedValue({
      success: true,
      data: { id: "bm-1" },
      tags: [],
    });

    const res = await POST(makeRequest({ url: "https://example.com" }));
    expect(res.status).toBe(200);
    expect(insertBookmarkMock).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({
        workspaceId: "550e8400-e29b-41d4-a716-446655440001",
      }),
    );
  });

  it("returns 409 on duplicate", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    insertBookmarkMock.mockResolvedValue({
      success: false,
      duplicate: true,
    });

    const res = await POST(makeRequest({ url: "https://example.com" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  it("returns 500 on non-duplicate failure", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    insertBookmarkMock.mockResolvedValue({
      success: false,
      error: "DB exploded",
    });

    const res = await POST(makeRequest({ url: "https://example.com" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB exploded");
  });

  it("backward-compatible: omitting title and tags behaves like before", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    insertBookmarkMock.mockResolvedValue({
      success: true,
      data: { id: "bm-1" },
      tags: [],
    });

    const res = await POST(
      makeRequest({
        url: "https://example.com",
        workspace_id: "550e8400-e29b-41d4-a716-446655440000",
        title: "tab title hint",
        // no tags
      }),
    );
    expect(res.status).toBe(200);
    expect(insertBookmarkMock).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({
        clientTitle: "tab title hint",
        tagNames: undefined, // omitted → undefined (server no-ops)
      }),
    );
  });
});
