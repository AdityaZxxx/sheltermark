# Replace binary `is_broken` with a 5-state `broken_status` enum

**Date**: 2026-07-19
**Status**: Superseded in part by [ADR-0002](./0002-remove-manual-override.md)

The original link-health design used a single boolean `is_broken` plus `http_status`, which collapsed four genuinely different states — a confirmed 404, a soft-404 heuristic match, a connection timeout, and a clean 200 OK — into "broken" or "not broken," leaving the UI no way to surface uncertainty or let users correct false positives. We replaced it with a `broken_status` enum (`alive | confirmed_broken | likely_broken | unknown | manual_override`) plus a `manually_marked_alive_at` column that lets a user's manual correction beat any automated check; the legacy `is_broken` column is kept and derived from the enum for backwards compatibility. The same refactor removed the per-domain result cache that was the primary source of false positives (one bad path poisoning every other URL on the host) — see `supabase/migrations/20260719003810_add_bookmark_link_health.sql` and `scripts/check-urls.ts`.

> **Update (2026-07-20):** The `manual_override` state and `manually_marked_alive_at` column were removed by [ADR-0002](./0002-remove-manual-override.md). The override lifecycle was buggy (the cron never expired overrides), and the feature created friction without the safety net the docs promised. The enum is now 4 states: `alive | confirmed_broken | likely_broken | unknown`.
