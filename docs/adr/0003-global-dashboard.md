# Add a Global Dashboard as a derived read model

**Date**: 2026-07-20
**Status**: Accepted

The Global Dashboard is a derived read model, not a canonical source of truth. It never owns bookmark data; it aggregates bookmark records from workspaces the current user can already access. Workspace remains the boundary for ownership, CRUD, trash, and import/export. The Dashboard is a first-class top-level route, parallel to workspace routes, introduced to fix a retrieval-vs-organization mismatch: users searching for a bookmark think in terms of the bookmark itself, not in terms of which workspace contains it. Search operates on bookmark records, not URLs — same URL in two workspaces surfaces as two distinct results. Bulk operations valid on a single bookmark (delete, tag, move) remain valid when initiated from the Dashboard; whether the implementation makes cross-workspace moves transactional is an implementation detail, not an architectural guarantee. The Chrome extension is intentionally out of scope: it stays a workspace-scoped save surface.

See `CONTEXT.md` for the canonical definitions of Bookmark, Workspace, and Global Dashboard.
