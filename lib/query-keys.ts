// Query keys follow the TanStack hierarchy [domain, userId, ...scope]: data
// is per-user, so the owner's id must be part of every key — a shared key
// would let one account's cached rows render for another (see
// SupabaseProvider, which clears the cache whenever the identity changes).
// Consumers always run inside requireAuth-gated trees, hence the required
// non-optional userId.
export const bookmarkKeys = {
  all: (userId: string) => ["bookmarks", userId] as const,
};

export const workspaceKeys = {
  all: (userId: string) => ["workspaces", userId] as const,
};

export const profileKeys = {
  all: (userId: string) => ["profile", userId] as const,
};

export const feedKeys = {
  all: (userId: string) => ["feeds", userId] as const,
};

export const trashKeys = {
  all: (userId: string) => ["trash", userId] as const,
  bookmarks: (userId: string) => ["trash", userId, "bookmarks"] as const,
  workspaces: (userId: string) => ["trash", userId, "workspaces"] as const,
};

export const tagKeys = {
  all: (userId: string) => ["tags", userId] as const,
  links: (userId: string) => ["tags", userId, "links"] as const,
  withCount: (userId: string) => ["tags", userId, "withCount"] as const,
  // Partial key: matches every per-bookmark link cache of this user.
  bookmarkLinksPrefix: (userId: string) =>
    ["tags", userId, "bookmark"] as const,
  byWorkspace: (userId: string, workspaceId: string) =>
    ["tags", userId, "byWorkspace", workspaceId] as const,
};
