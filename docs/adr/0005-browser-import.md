# Native browser bookmark import

**Date**: 2026-08-15
**Status**: Accepted

The Import/Export context previously supported only Sheltermark-generated JSON and CSV. Users migrating from a browser had to manually convert their `bookmarks.html` (or equivalent) into one of these formats before they could import — which made the import feature technically functional but a poor migration path. Since the browser is the source of truth during migration, the import feature must accept browser-native formats directly.

This ADR records the architectural decisions for adding native browser-bookmark import (Netscape `bookmarks.html`) to the existing import pipeline. The change is additive: no parallel import system, no changes to the domain model, no new entities.

## Decisions

### Netscape `bookmarks.html` only for v1

The Netscape Bookmark File format is the common export format shared by Chrome, Firefox, Edge, and Safari. Parsing one format covers four sources at a low marginal cost. Firefox `places.sqlite` (richer — tags, visit metadata, real folders) and direct browser sync APIs (Chrome `chrome.bookmarks`, etc.) are deferred to separate projects because they require new infrastructure (SQLite parsing, browser-side auth flows) without changing the import pipeline itself.

### Reuse the existing import pipeline, don't add a new one

The existing pipeline — `parseImportFile` → `previewImport` (server action) → `importBookmarks` (server action) — works as-is once the fileType union is extended with `"netscape"`. The server re-parses the file on each call (existing pattern); we do not introduce preview tokens or temporary server state. This keeps the import architecture single-tracked.

### Client-side parsing

Browser exports can be 10-50 MB once embedded favicon data URLs are included. Vercel's request-body limits (4.5 MB on hobby, larger on Pro) make server-side parsing fragile. Parsing client-side mirrors the existing JSON/CSV pattern (which already uses `FileReader` + `parseImportFile` in the browser) and removes the body-size ceiling entirely.

### Real HTML parser (`parse5`), not regex

Netscape Bookmark File is a 30-year-old format with stable grammar, but real browser exports include malformed content (user edits, mixed line endings, unusual attributes). A real HTML5 parser handles these gracefully; a regex parser does not. `parse5` was already a transitive dependency via `cheerio`; this change makes it a direct dependency.

### Content-based format detection, not filename-based

Files can be named anything (`bookmarks.html`, `export.txt`, `chrome-bookmarks`). Detection looks at the content: `NETSCAPE-Bookmark-file-1` magic signature in the first 1 KB. The detector does only magic-signature routing; structural validity is the parser's responsibility. The detector's output is `"json" | "csv" | "netscape" | "unknown"`; `"unknown"` triggers a clear error in the UI.

### `folderPath: string[]` is non-persistent

Browser folder hierarchy (e.g. `["Bookmarks bar", "Programming", "React"]`) is preserved as `folderPath` on each `ParsedBookmark` during the import flow. This field is used only for preview rendering and folder-tree filtering; it is never written to the bookmark table. Persisting it would pollute the bookmark entity with source-format structure that Sheltermark's domain doesn't recognize.

Folders flatten into a single user-selected target workspace. No new `Folder` entity, no workspace-per-folder, no folder-as-tag. If first-class folders become desirable in the future, that should be a separate domain-model decision — not something imported accidentally through the import feature.

### Existing URL normalization remains authoritative

The same `(user_id, workspace_id, normalized_url)` uniqueness invariant applies. Browser imports go through `normalizeUrl()` like every other write. Any false-positive duplicate behavior caused by aggressive normalization (e.g., desktop vs. mobile URLs collapsing) is a pre-existing normalization limitation, not a regression introduced by browser import.

### Browser-exported title is trusted; `ADD_DATE` is ignored

The browser export carries the user's view of each bookmark. We treat its title as authoritative for the initial row and let the metadata pipeline refine it later (or via manual refetch). `ADD_DATE` and `LAST_MODIFIED` from the export are deliberately ignored — `createdAt` in Sheltermark means "moment of insertion", and changing that semantic would alter every other code path that depends on it.

URLs equal to their own title (e.g. `<A HREF="https://example.com/">https://example.com/</A>`) are flagged as low-quality for any future metadata-enrichment work, but are not specially handled in v1.

### Background metadata enrichment is deferred

A 5,000-bookmark browser import with synchronous metadata fetching would leave the user staring at a progress bar for 10+ minutes. v1 keeps the import fast by persisting browser-exported metadata (title + embedded favicon data URL) immediately. Real-time enrichment is a separate project that needs its own queue, retry, and merge-policy design. Embedded favicon data URLs (often present in browser exports via the `ICON` attribute) are extracted up to a 64 KB cap to avoid DB bloat; missing or oversized icons are handled via the existing manual-refetch path.

### Folder selection state is ephemeral

Folder selection lives in component state during the preview step. If the user refreshes the dialog, they re-upload the file. We do not persist preview state in `sessionStorage`. Re-upload is fast and the alternative adds complexity for marginal benefit.

## Folder selection UX

By default, every folder is selected. The preview shows a folder tree with checkboxes; unchecking a folder excludes its bookmarks from the import. Selection state propagates to the server as a `folderPaths: string[]` parameter, where it filters the parsed bookmarks before duplicate detection and persistence. An empty `folderPaths` value combined with a Netscape file type triggers the server-side filter unconditionally — the client always sends an explicit selection, never relies on default-on-the-server.

Import semantics, per the acceptance criterion:

- **Nothing selected** (zero folders checked, or all filtered out): the Import button is disabled; the user sees "Select at least one folder." Zero-bookmark imports are not allowed.
- **All candidates are duplicates**: import completes as a successful no-op with counts `"0 imported, N duplicates skipped"`.
- **Partial duplicates or rejections**: import completes normally with counts `"X imported, Y duplicates skipped, Z invalid"`.

## Consequences

### Positive

- Users migrating from Chrome/Firefox/Edge/Safari can import in a single step with no file transformation.
- No new entities, no schema changes, no domain-model drift.
- Existing JSON/CSV import behavior is unchanged.
- `parse5` is now a direct, explicit dependency — no reliance on transitive resolution.

### Negative

- `parse5` adds ~20 KB gzipped to the client bundle when the import dialog is loaded. Mitigated by route-segmentation of the dashboard and the dialog's lazy mount.
- Firefox `places.sqlite`, direct browser sync, and competitor importers (Pocket, Pinboard, Raindrop) remain unsupported. Each is a separate project.
- Background metadata enrichment is deferred; the user may need to manually refetch some bookmarks to get fresh titles or favicons.
- Real-world browser export variance may surface edge cases not covered by the fixtures. Future bugs in the parser should be fixed by adding fixture-based tests, not by relaxing parsing rules.

### Neutral

- `importOptionsSchema` gains an optional `folderPaths: string[]` field. Existing callers (JSON/CSV imports) omit it; behavior is unchanged.
- `ParsedBookmark` gains an optional `folderPath: string[]`. The repository layer (`batchInsertBookmarks`) ignores the field — `folderPath` never reaches the database.

## Files

- `lib/import/detect.ts` — content-based format detection
- `lib/import/netscape.ts` — Netscape parser using `parse5`
- `lib/import/folder-filter.ts` — folder-path key encoding and filtering
- `lib/import/parsers.ts` — extended `fileType` union
- `lib/import/tests/fixtures/` — real-world browser export fixtures
- `app/action/import.action.ts` — `folderPaths` filter support
- `lib/schemas/profile.schema.ts` — `importOptionsSchema.folderPaths`
- `hooks/use-import-dialog.ts` — folder-selection state, content-based detection
- `components/import-export/{upload,preview,done}-step.tsx`, `folder-tree.tsx` — UI
- `package.json` — `parse5` as direct dependency
