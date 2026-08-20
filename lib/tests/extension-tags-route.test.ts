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

const getTagsWithCountMock = mock();

mock.module("~/lib/data/repositories/tag.repository", () => ({
  getTagsWithCount: (...args: unknown[]) => getTagsWithCountMock(...args),
}));

const createClientMock = mock();

mock.module("~/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

// Route passes getDb() through to the (mocked) repository; stub it so the
// test never needs a live DATABASE_URL.
mock.module("~/lib/data/db", () => ({
  getDb: () => ({}),
}));

function makeSupabase({ user }: { user: { id: string } | null }) {
  return {
    auth: {
      getUser: mock(async () => ({
        data: { user },
        error: user ? null : { message: "no user" },
      })),
    },
  };
}

beforeEach(() => {
  getTagsWithCountMock.mockReset();
  createClientMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  mock.restore();
});

const { GET } = await import("~/app/api/extension/tags/route");

describe("GET /api/extension/tags", () => {
  it("returns authenticated=false with empty tags when no user", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ authenticated: false, tags: [] });
    expect(getTagsWithCountMock).not.toHaveBeenCalled();
  });

  it("returns user-scoped tag list with counts on success", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    getTagsWithCountMock.mockResolvedValue({
      success: true,
      data: [
        { id: "t1", user_id: "u1", name: "dev", created_at: "...", count: 5 },
        {
          id: "t2",
          user_id: "u1",
          name: "reading",
          created_at: "...",
          count: 2,
        },
      ],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authenticated).toBe(true);
    expect(json.tags).toHaveLength(2);
    expect(json.tags[0]).toEqual({
      id: "t1",
      user_id: "u1",
      name: "dev",
      created_at: "...",
      count: 5,
    });
    expect(getTagsWithCountMock).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("returns 500 on repository failure", async () => {
    createClientMock.mockResolvedValue(makeSupabase({ user: { id: "u1" } }));
    getTagsWithCountMock.mockResolvedValue({
      success: false,
      error: "boom",
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("boom");
  });
});
