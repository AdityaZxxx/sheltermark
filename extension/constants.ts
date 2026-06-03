export const DEFAULT_BASE_URL = "https://sheltermark.vercel.app";
export const NOTIFICATION_DURATION = 3000;

export const MESSAGE_TYPES = {
  SAVE_BOOKMARK: "SAVE_BOOKMARK",
  GET_TAB_INFO: "GET_TAB_INFO",
  CHECK_AUTH: "CHECK_AUTH",
  GET_WORKSPACES: "GET_WORKSPACES",
  X_BOOKMARK_CAPTURED: "X_BOOKMARK_CAPTURED",
  CHECK_BOOKMARK: "CHECK_BOOKMARK",
  CHECK_BOOKMARK_CACHED: "CHECK_BOOKMARK_CACHED",
  CHECK_BOOKMARK_SETTLED: "CHECK_BOOKMARK_SETTLED",
} as const;

type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

interface MessageBase {
  type: MessageType;
}

interface SaveBookmarkMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.SAVE_BOOKMARK;
  data: { url: string; title?: string | null; workspaceId?: string | null };
}

interface GetTabInfoMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.GET_TAB_INFO;
}

interface CheckAuthMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_AUTH;
}

interface GetWorkspacesMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.GET_WORKSPACES;
}

interface XBookmarkCapturedMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.X_BOOKMARK_CAPTURED;
  url: string;
}

interface CheckBookmarkMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_BOOKMARK;
  data: { url: string; workspaceId?: string };
}

interface CheckBookmarkCachedMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_BOOKMARK_CACHED;
  data: { url: string; workspaceId: string };
}

interface CheckBookmarkSettledMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_BOOKMARK_SETTLED;
  data: { url: string; workspaceId: string };
}

export type ExtensionMessage =
  | SaveBookmarkMessage
  | GetTabInfoMessage
  | CheckAuthMessage
  | GetWorkspacesMessage
  | XBookmarkCapturedMessage
  | CheckBookmarkMessage
  | CheckBookmarkCachedMessage
  | CheckBookmarkSettledMessage;

export interface SaveResult {
  success?: boolean;
  duplicate?: boolean;
  needsLogin?: boolean;
  error?: string;
}

export interface Workspace {
  id: string;
  name: string;
  is_default?: boolean;
}

export interface TabInfo {
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export interface AuthResult {
  authenticated?: boolean;
}

export interface CheckResult {
  saved?: boolean;
}
