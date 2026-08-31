# Cloud Backup v1: manual backup to user-owned cloud storage

**Date**: 2026-08-29
**Status**: Accepted

## Context

Sheltermark has JSON/CSV export (download) and import (upload) as the
portability layer. Raindrop-style cloud backup — pushing a copy of the
user's data into their own Google Drive / Dropbox / OneDrive on demand —
complements it: export requires the user to remember to download and store
the file; a cloud backup pushes it somewhere durable with one click.

## Decision

1. **Backup content = the canonical JSON export format, unchanged.** A
   backup file is byte-identical in shape to `Export → JSON` (version 1.0,
   workspaces → bookmarks), extended with `note` and `tags` per bookmark —
   fields the export already owns in the database but previously dropped.
   There is no proprietary backup format, no version history, no manifest.
   Restore feeds the file straight back through the existing import
   pipeline (`parseImportFile` + `batchInsertBookmarks`).
2. **One OAuth connection per user per provider** (`cloud_connections`
   table), providers: Google Drive, Dropbox, OneDrive. Connection =
   explicit user authorization via the standard OAuth code flow. Tokens are
   stored plaintext under RLS owner-only policies — same posture as any
   app storing provider tokens; acceptable because the tokens' scope is
   file-write into a dedicated app folder, not account-wide access.
   (Drive: `drive.file` — per-file scope, only files this app created.
   OneDrive: `Files.ReadWrite.AppFolder` + `Files.ReadWrite`.)
3. **Backups live in `Sheltermark/Backups/`** in the user's own storage
   (Raindrop parity), one file per calendar day
   (`sheltermark-backup-YYYY-MM-DD.json`), overwritten on re-run the same
   day. No pruning in v1 — the folder is the user's storage; deleting
   their files is a policy decision that needs its own conversation.
4. **Manual backup only.** "Back Up Now" button in Settings. The product
   has no scheduler/queue for user-scoped jobs (crons are global,
   service-role), so automatic backup would need new infrastructure. Ship
   manual first; add a cron/scheduled backup only when the architecture
   makes it straightforward.
5. **Restore = preview + confirm, then import pipeline.** The dialog
   downloads and parses the file, shows workspace/counts/duplicate
   strategy (skip | replace — the existing Import Strategy vocabulary),
   and only then writes. Restore groups by workspace name, creating
   missing workspaces; it never deletes data the backup doesn't mention.
6. **Errors are generic to users.** Provider API failures (quota, network,
   revoked grant) are logged server-side with provider + status and
   surface as "Something went wrong. Please try again." or an explicit
   "Connection expired. Reconnect to continue." when the refresh grant is
   dead. Raw provider payloads never reach the client.
7. **OAuth state is HMAC-signed** (`provider.expiry.signature`, keyed off
   the service secret) — binds the callback to the initiated provider and
   a 10-minute window without server-side session storage for the dance.
   Client secret rotation invalidates in-flight dances only.

## Consequences

- No real-time sync, conflict resolution, incremental sync, version
  history, or backup format — by scope decision. The JSON export remains
  the interop escape hatch and is always available.
- `exportBookmarksForBackup` reads bookmarks + tags + notes; derived data
  (health status, AI fields, previews, feed sync state) is regenerable
  and excluded.
- Migration is additive (`cloud_connections` + RLS), safe to ride along
  with a Vercel deploy.
- Provider credentials are env vars (`DROPBOX_CLIENT_ID/SECRET`,
  `MS_CLIENT_ID/SECRET`; Google reuses the existing Google OAuth pair).
  Until configured, the UI shows the provider buttons and the authorize
  route redirects back with `backup=unconfigured`.
- Knip note: `previewRestore`'s `backupName` echoes the file id — the
  display name comes from the list endpoint.
