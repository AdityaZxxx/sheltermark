export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  byWorkspace: (workspaceId?: string, userId?: string) =>
    ["bookmarks", workspaceId, userId] as const,
  detail: (id: string) => ["bookmarks", "detail", id] as const,
};

export const workspaceKeys = {
  all: ["workspaces"] as const,
  byUser: (userId?: string) => ["workspaces", userId] as const,
  detail: (id: string) => ["workspaces", "detail", id] as const,
};

export const profileKeys = {
  all: ["profile"] as const,
  byUser: (userId?: string) => ["profile", userId] as const,
  detail: (id: string) => ["profile", "detail", id] as const,
};

export const urlHealthKeys = {
  all: ["url-health"] as const,
  byWorkspace: (workspaceId: string) =>
    ["url-health", "workspace", workspaceId] as const,
};

export const feedKeys = {
  all: ["feeds"] as const,
  byUser: (userId?: string) => ["feeds", userId] as const,
  detail: (id: string) => ["feeds", "detail", id] as const,
  entries: (feedId: string) => ["feeds", "entries", feedId] as const,
};
