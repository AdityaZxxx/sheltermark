export const DEFAULT_BASE_URL = "https://sheltermark.vercel.app";
export const NOTIFICATION_DURATION = 3000;

export const MESSAGE_TYPES = {
  SAVE_BOOKMARK: "SAVE_BOOKMARK",
  GET_TAB_INFO: "GET_TAB_INFO",
  X_BOOKMARK_CAPTURED: "X_BOOKMARK_CAPTURED",
  CHECK_BOOKMARK: "CHECK_BOOKMARK",
  CHECK_BOOKMARK_SETTLED: "CHECK_BOOKMARK_SETTLED",
  GET_POPUP: "GET_POPUP",
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

interface XBookmarkCapturedMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.X_BOOKMARK_CAPTURED;
  url: string;
}

interface CheckBookmarkMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_BOOKMARK;
  data: { url: string; workspaceId?: string };
}

interface CheckBookmarkSettledMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.CHECK_BOOKMARK_SETTLED;
  data: { url: string; workspaceId: string };
}

interface GetPopupMessage extends MessageBase {
  type: typeof MESSAGE_TYPES.GET_POPUP;
  data: { url: string; workspaceId: string | null };
}

export type ExtensionMessage =
  | SaveBookmarkMessage
  | GetTabInfoMessage
  | XBookmarkCapturedMessage
  | CheckBookmarkMessage
  | CheckBookmarkSettledMessage
  | GetPopupMessage;

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

export interface CheckResult {
  saved?: boolean;
}

export interface PopupInfo {
  authenticated: boolean;
  workspaces?: Workspace[];
  lastWorkspace: string | null;
  alreadySaved: boolean;
  bookmarkId: string | null;
}
