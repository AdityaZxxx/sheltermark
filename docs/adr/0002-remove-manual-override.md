# Remove the manual-override state from broken-link detection

**Date**: 2026-07-20
**Status**: Accepted
**Supersedes part of**: [ADR-0001](./0001-broken-status-enum.md)

## Context

ADR-0001 introduced a 5-state `broken_status` enum including `manual_override`, paired with a `manually_marked_alive_at` timestamp. The intent was to let users dismiss false-positive broken-link warnings. The implementation had two flaws:

1. **Override expiry was dead code.** The `isManualOverrideStale(markedAt, now)` helper (1-week threshold) existed in `lib/utils/broken-link.ts` but the cron never called it — `persistResult` skipped ANY bookmark with `manually_marked_alive_at` set, regardless of age. So once a user marked a link "working", it was never re-checked. The next weekly cron would not overwrite the override even if the link had since broken.

2. **Contradictory documentation.** The docstring on `markBookmarkAlive` (and the comment on `bookmarkMarkAliveSchema`) claimed the cron would re-check on its next cadence and overwrite a stale override. This was false. The CONTEXT.md definition of Manual Override said the next health-check run "skips the bookmark entirely," which matched the code but not the docstrings.

The result: a user's "mark as working" stuck forever, even after the link later broke. The feature created friction (users had to manage overrides) without the safety net the docs promised.

## Decision

Remove the manual-override feature entirely. The `broken_status` enum shrinks from 5 states to 4:

```
alive | confirmed_broken | likely_broken | unknown
```

The `manually_marked_alive_at` column is dropped. Existing rows with `broken_status = 'manual_override'` are reset to `'alive'` (with `is_broken = false`) so the next weekly cron re-evaluates them honestly.

In place of the override escape hatch, invest in better detection to reduce the false positives that motivated the override in the first place:

- **401/403 as `unknown`** instead of `confirmed_broken` — a public URL returning 401/403 usually means bot-detection or auth-walling, not that the page is gone.
- **Hostname matching for always-alive domains** — `isAlwaysAliveDomain` now uses `URL.hostname` instead of `String.includes`, so `https://evil.com/twitter.com` no longer falsely short-circuits. Subdomains (`api.twitter.com`) still match.
- **Smarter soft-404 signals** — beyond body keywords and `<title>` shape, detect `class="error-page|page-404|not-found-page"`, canonical URLs pointing at `/404` or `/not-found`, and JSON error payloads (`{"error": "not found"}`). All gated on the existing short-body threshold.
- **Per-host throttling in the cron** — at most one concurrent request per hostname, preventing accidental DoS of a single domain and reducing 429s.

## Consequences

- **No user-facing escape hatch for false positives.** A user who sees a false "broken" warning cannot dismiss it. The mitigation is that the detection is more accurate: 401/403 no longer produce false "broken" claims, and the soft-404 heuristics are both broader (catch more real soft-404s) and still gated (no new false-positive classes).
- **`is_broken` derivation changes.** Previously `is_broken` was true for `confirmed_broken | likely_broken`. The 401/403 change moves those from `confirmed_broken` to `unknown`, so `is_broken` is now false for them. Any code that previously filtered on `is_broken = true` will stop surfacing 401/403 bookmarks as broken — this is the desired behavior.
- **The `manual_override` enum value is gone from the CHECK constraint.** Any application code that writes `'manual_override'` will fail at the DB level. All such write sites have been removed.
- **Per-host throttling reduces effective concurrency.** A run with 100 bookmarks across 5 hosts now processes ~5 at a time (one per host) instead of 10. This is slower but safer. The 500-bookmarks-per-run cap still applies.
