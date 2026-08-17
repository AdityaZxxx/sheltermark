# Extension API

Chrome extension ↔ backend communication over HTTP. All endpoints receive session cookies (`credentials: "include"`) — no auth tokens are stored in the extension.

## Endpoints

### `GET /api/extension/popup`

**Purpose:** Popup UI initialization. Single round-trip for auth state, workspace list, and duplicate check.

**Request:**

```
GET /api/extension/popup?url=https%3A%2F%2Fexample.com&workspace_id=ws_abc123
```

| Param          | Required | Notes                                                         |
| -------------- | -------- | ------------------------------------------------------------- |
| `url`          | No       | Current tab URL. Used for duplicate check. Skipped if empty.  |
| `workspace_id` | No       | The workspace to check against. Falls back to user's default. |

**Response (`200`):**

```json
{
  "authenticated": true,
  "workspaces": [{ "id": "ws_abc123", "name": "Personal", "is_default": true }],
  "lastWorkspace": "ws_abc123",
  "alreadySaved": true,
  "bookmarkId": "bm_xyz"
}
```

| Field           | Always present | Notes                                                                                                                                                           |
| --------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authenticated` | Yes            | `false` when session expired or not logged in                                                                                                                   |
| `workspaces`    | Yes            | Empty array when unauthenticated                                                                                                                                |
| `lastWorkspace` | Yes            | `null` when unauthenticated. Server-resolves the default: supplied `workspace_id`, then the workspace marked `is_default`, then first workspace by `created_at` |
| `alreadySaved`  | Yes            | `false` when `url` is not supplied or is invalid                                                                                                                |
| `bookmarkId`    | When saved     | Resource ID of the existing bookmark. Useful for future "Open" / "Edit" / "Reveal in Workspace" actions                                                         |

**Response (`200` unauthenticated):** `{"authenticated": false, "workspaces": [], "lastWorkspace": null, "alreadySaved": false, "bookmarkId": null}`

**Response (`500`):** Logged server-side; returns unauthenticated shape (graceful degradation).

**Consumed by:** Popup initialization and popup refresh on focus/visibility.

---

### `POST /api/extension/bookmark`

**Purpose:** Save a bookmark. Single source of truth for duplicate detection.

**Request:**

```json
{
  "url": "https://example.com/article",
  "workspace_id": "ws_abc123",
  "title": "Optional page title"
}
```

| Field          | Required | Notes                                                                  |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `url`          | Yes      | Server validates `http:` / `https:` protocol before persisting         |
| `workspace_id` | No       | Falls back to user's default workspace                                 |
| `title`        | No       | Client-supplied title; used as fallback if server metadata fetch fails |

**Response (`200`):** `{"success": true, "data": {...bookmark}}`

**Response (`401`):** `{"error": "Unauthorized"}` — session invalid or expired

**Response (`409`):** `{"error": "Bookmark already exists"}` — URL is a duplicate in the target workspace

**Response (`400`):** `{"error": "Invalid URL"}` — non-http(s) protocol rejected server-side

**Consumed by:** All save flows: popup save button, keyboard shortcut, context menus, X capture.

---

### `GET /api/extension/workspaces`

**Purpose:** List the user's workspaces.

**Request:** No parameters. Auth required.

**Response (`200`):** `{"workspaces": [{ "id": "ws_abc123", "name": "Personal", "is_default": true }]}`

**Response (`401`):** `{"error": "Unauthorized"}`

**Consumed by:**

- Background `getWorkspaces()` — populates `sessionCache.workspaces` for `resolveWorkspaceName()` (used in notification messages: "Already saved in Personal")
- Background `getWorkspaces()` — context menu saves pass the workspace name implicitly

---

### `GET /api/extension/check`

**Purpose:** Check whether a URL is bookmarked in a workspace. Used for the re-check UX when the user switches workspaces in the popup.

**Request:**

```
GET /api/extension/check?url=https%3A%2F%2Fexample.com&workspace_id=ws_abc123
```

| Param          | Required | Notes                                    |
| -------------- | -------- | ---------------------------------------- |
| `url`          | Yes      | URL to check                             |
| `workspace_id` | No       | If omitted, checks across all workspaces |

**Response (`200`):** `{"saved": true, "bookmark_id": "bm_xyz"}`

**Response (`200` not found):** `{"saved": false, "bookmark_id": null}`

**Response (`400`):** `{"error": "url parameter is required"}` or invalid protocol — returns `saved: false` (graceful degradation)

**Consumed by:**

- Popup workspace-change handler — re-checks the URL against the newly selected workspace

---

## Architectural invariants

### Auth

All endpoints use Supabase session cookies. No tokens are stored in `chrome.storage`. The extension relies on `credentials: "include"` to send cookies on every fetch.

### Duplicate detection lives in one place

`POST /api/extension/bookmark` is the only endpoint that writes and the only endpoint that returns `409 duplicate`. The popup never makes a unilateral "this URL is a duplicate" decision — it learns it from the save response or from the `/popup` / `/check` pre-checks. `GET /api/extension/check` and `GET /api/extension/popup` are for UI state only and do not affect the source of truth.

### URL validation is server-enforced

`GET /api/extension/check` and `POST /api/extension/bookmark` both validate `http:` / `https:` protocol on the server. A `javascript:` or `data:` URL sent by a compromised client will be rejected before storage.

### `/popup` is for UI only

`GET /api/extension/popup` aggregates auth, workspace list, and duplicate check for the popup's convenience. It is not the authoritative save path. Keyboard shortcuts and context menus do not use it — they go directly to `POST /api/extension/bookmark` (and `GET /api/extension/workspaces` for workspace-name resolution).

### Caching strategy

| Cache                     | Location               | TTL                                               | Invalidation                      |
| ------------------------- | ---------------------- | ------------------------------------------------- | --------------------------------- |
| `sessionCache.workspaces` | Background memory      | Until cleared by `invalidateCache()` after a save | Cleared on any bookmark save      |
| `lastWorkspace`           | `chrome.storage.local` | Permanent per device                              | Updated on every workspace change |

The `sessionCache.workspaces` cache serves the popup's duplicate-check notification (`"Already saved in Personal"`) and is rebuilt lazily by `GET /api/extension/workspaces`.

### URL validation and SSRF protection

The extension API routes validate that `url` is `http:` / `https:` before use — `GET /api/extension/check`, `GET /api/extension/popup`, and `POST /api/extension/bookmark` all reject other protocols. These routes only run database lookups.

The DNS / private-IP checks (rejecting `10.x`, `172.16.x`, `192.168.x`, `127.x`, `localhost` to prevent SSRF-to-local-network) live in the **server-side metadata fetch** (`lib/metadata/fetch.ts`), which runs when enriching a saved bookmark. They are not part of the popup or check GET routes.

---

## Flows and endpoint consumption

| Flow                                        | Endpoints called                               |
| ------------------------------------------- | ---------------------------------------------- |
| **Popup open**                              | `GET /api/extension/popup`                     |
| **Popup workspace change**                  | `GET /api/extension/check`                     |
| **Popup save button**                       | `POST /api/extension/bookmark`                 |
| **Keyboard shortcut**                       | `POST /api/extension/bookmark`                 |
| **Context menu (page / link)**              | `POST /api/extension/bookmark`                 |
| **X capture (bookmark button click)**       | `POST /api/extension/bookmark`                 |
| **Resolve workspace name for notification** | `GET /api/extension/workspaces` (memory cache) |

All non-popup save flows go directly to `POST /api/extension/bookmark`; an expired session surfaces as `401` and is reported as "Login required". There is no separate auth pre-check endpoint.
