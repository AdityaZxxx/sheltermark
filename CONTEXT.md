# Sheltermark

A cross-device bookmark manager. Next.js web app + Chrome extension, backed by Supabase. Users save URLs that are auto-enriched with metadata, organize them into workspaces, and optionally share public collections.

## Language

### Bookmark Management

**Bookmark**:
The canonical data entity. A saved URL enriched with fetched metadata (title, favicon, OG image) and an optional user note. Each bookmark belongs to exactly one workspace. Same URL in two workspaces is two distinct bookmarks with potentially different notes, tags, and metadata.
_Avoid_: Link, page, saved URL

**Workspace**:
A named collection of bookmarks that defines ownership and organization. Has visibility (public/private), a default flag, and an auto-check-broken toggle. Every user has exactly one default workspace, created on first sign-in. The boundary for ownership, CRUD, trash, and import/export; not the boundary for retrieval.
_Avoid_: Folder, collection, category, group

**Global Dashboard**:
A derived aggregation layer for retrieval across all workspaces the current user can access. Never owns bookmark data. Reads bookmark records and presents them without transformation: same URL in two workspaces surfaces as two separate results. All CRUD, ownership, and canonical URLs remain at the workspace level.
_Avoid_: Global view, all bookmarks page (implies ownership)

**Tag**:
A lightweight, user-scoped label attached to bookmarks via a many-to-many junction. Reused across bookmarks by name. Cheap and disposable: hard-delete, no trash.
_Avoid_: Label, category, keyword

**Feed**:
An RSS/Atom subscription that produces bookmarks from feed items. A Feed is a _source_ of bookmarks, not a bookmark itself. May feed into a specific workspace or the user's default.
_Avoid_: Subscription, RSS feed (redundant)

**View Variant**:
One of three display modes for a bookmark list, persisted to localStorage:

- **List** — browser-tab style vertical rows. Minimal: favicon, title, domain, date. No notes, tags, or images. Optimized for quick keyboard-navigable scanning.
- **Comfort** — rich metadata density. Same vertical flow as List but adds notes, tags, OG image thumbnail, and date. For reading/curating.
- **Card** — visual-first discovery. OG hero image is the primary element, with title overlay, domain, and date. No notes or tags.
  _Avoid_: Layout, mode, display mode

**Metadata**:
A value object: `{ title, description, og_image_url, favicon_url }`. Immutable snapshot fetched from a URL at bookmark-creation time via a multi-strategy pipeline. User can manually refetch.
_Avoid_: Preview, link preview, card preview

### Link Health

**Health Check**:
A single HTTP evaluation of a bookmark's URL, producing a `UrlHealthResult`. Per-bookmark, not per-domain — an earlier per-domain cache was removed because one bad path poisoned every URL on that host. The cron also throttles per-hostname: at most one concurrent request per hostname.

**Broken Status**:
A 4-state enum on each bookmark: `alive | confirmed_broken | likely_broken | unknown`. Replaces the legacy binary `is_broken` (still kept, derived from the enum, for backwards compatibility). See `docs/adr/0001-broken-status-enum.md` and `docs/adr/0002-remove-manual-override.md`.
_Avoid_: Health status, link status

**Soft 404**:
A page that returns HTTP 200 but contains "not found" content. Requires short body (< 4KB) AND at least one of: title match, body keyword match, error-page CSS class, canonical URL pointing at `/404` or `/not-found`, or JSON error payload. Any single signal alone (without short body) is insufficient.
_Avoid_: False 404, hidden 404

**Always-Alive Domain**:
Domains known to be walled-garden platforms that reject automated checks (twitter.com, x.com, youtube.com, instagram.com, tiktok.com, facebook.com). Skipped entirely — returned as `alive`. Matched by hostname, so subdomains (`api.twitter.com`) also skip but `https://evil.com/twitter.com` does not.

**Ambiguous Status**:
HTTP 401 and 403 on a public URL are classified as `unknown` rather than `confirmed_broken`, because they usually mean bot-detection or auth-walling rather than the page being gone.

### Account & Identity

**User**:
The authenticated principal (managed by Supabase Auth). Has an email or OAuth identity, a session, and a unique UUID.
_Avoid_: Account (overloaded — see Profile), login, member

**Profile**:
The user's public-facing identity: username, display name, avatar, bio, social links, public/private toggle, and trash cleanup interval. 1:1 with User. Also serves as the user's settings store.
_Avoid_: Account (overloaded — see User), user settings, user record

**Public Page**:
The route `/u/[username]` rendering a user's public workspaces and profile. Gated by profile visibility; if private, shows a "private profile" state.
_Avoid_: Public profile (refers to the Profile entity, not the route)

### Trash & Lifecycle

**Trash**:
The state a Bookmark or Workspace enters when "deleted" by the user. Restorable until the cleanup interval expires.
_Avoid_: Recycle bin, deleted items, archive

**Restore**:
Undoing a trash. For workspaces, cascades to its bookmarks with duplicate-URL detection in the target workspace.
_Avoid_: Undelete, recover

**Cleanup Interval**:
Days after which trashed items are auto-permanently-deleted. Per-user, set on the profile (7 or 30).
_Avoid_: Retention period, TTL

### Import/Export

**Import Strategy**:
How duplicates in the target workspace are handled during import: `skip` (ignore incoming) or `replace` (delete existing, insert imported).
_Avoid_: Duplicate mode, conflict resolution

**Import Preview**:
A dry-run showing total bookmarks, valid count, duplicate count, and workspace distribution before committing. For browser imports, also shows a folder tree so the user can deselect folders they don't want.
_Avoid_: Import summary, pre-check

### Cloud Backup

**Cloud Backup**:
A one-click copy of the user's bookmarks pushed into their own cloud storage (Google Drive, Dropbox, or OneDrive), stored under `Sheltermark/Backups/` in the canonical JSON export format. Complements Import/Export — same data, different delivery. Manual only in v1: no scheduler, no sync.
_Avoid_: Sync, cloud sync, backup job

**Cloud Connection**:
The per-user, per-provider OAuth authorization for Cloud Backup. One per provider; connecting another provider replaces it. Holds access/refresh tokens plus last backup status. Owner-only (RLS).
_Avoid_: Integration, linked account

**Backup File**:
One JSON file per calendar day (`sheltermark-backup-YYYY-MM-DD.json`) in the `Sheltermark/Backups/` folder of the connected provider. Same shape as the JSON export; re-running a backup the same day overwrites the file.
_Avoid_: Snapshot, version

**Restore**:
Downloading a Backup File and running it through the existing import pipeline behind a preview/confirmation step. Duplicates follow the Import Strategy vocabulary; bookmarks land in same-named workspaces (created when missing).
_Avoid_: Migration, sync back, rollback

**Browser Bookmark Export**:
The `bookmarks.html` file Chrome, Firefox, Edge, and Safari produce when the user clicks "Export bookmarks". Netscape Bookmark File format. Parsed client-side and converted into the same `ParsedBookmark[]` shape as Sheltermark JSON/CSV imports. Folder hierarchy is preserved as `folderPath` on each candidate for preview filtering only — never persisted.
_Avoid_: Native bookmark format, browser bookmarks (when used as a noun without the file context)

**Folder Path**:
An ordered array of folder-name segments representing a browser-exported bookmark's location, e.g. `["Bookmarks bar", "Programming", "React"]`. Used during browser-import preview to filter which folders to import. Non-persistent.
_Avoid_: Breadcrumb, folder breadcrumb, path
