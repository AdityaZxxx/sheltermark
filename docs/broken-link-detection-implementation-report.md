# Broken-Link Detection — Implementation Report

> Companion to `docs/broken-link-detection-design-review.md`. This report
> documents the high-impact changes shipped from the design review's
> roadmap (§6 P0–P1), the test coverage added, and the design decisions
> that remain intentionally unchanged.

---

## 1. What changed

### 1.1 HTTP status classification — spec-correct transient handling

**Files:** `lib/link-health/checker.ts`, `lib/utils/http-fetch.ts`, `lib/utils/broken-link.ts`

The largest source of false positives was the classification of
server-side and transient failures as `confirmed_broken`. Per HTTP RFC
semantics (RFC 9110 §15.6, RFC 6585), these codes mean "the server
couldn't handle this request" or "the client is being throttled" — not
"the resource is gone."

**Reclassified `confirmed_broken` → `unknown`:**

| Status                          | RFC meaning                     | Was                              | Now                 | Reason            |
| ------------------------------- | ------------------------------- | -------------------------------- | ------------------- | ----------------- |
| 5xx (500–599)                   | Server error (§15.6)            | `confirmed_broken`               | `unknown`           | `server_error`    |
| 504                             | Gateway Timeout (§15.6.5)       | `confirmed_broken` (not retried) | `unknown` (retried) | `server_error`    |
| 429                             | Too Many Requests (RFC 6585 §4) | `confirmed_broken`               | `unknown`           | `rate_limited`    |
| 408                             | Request Timeout                 | `confirmed_broken`               | `unknown`           | `transient`       |
| 425                             | Too Early                       | `confirmed_broken`               | `unknown`           | `transient`       |
| 405/406/415/416/421/426/428/431 | Client/protocol issues          | `confirmed_broken`               | `unknown`           | `client_protocol` |

**Still `confirmed_broken`** (authoritative absence or explicit conflict):

- 404 (Not Found), 410 (Gone), 451 (Legal)
- 400, 409, 412, 422 (request/resource conflict — debatable but defensible)

**Retry status expansion:** `DEFAULT_RETRY_STATUSES` in `http-fetch.ts`
now includes `504`. Previously a single 504 Gateway Timeout went straight
to `confirmed_broken` without retry; now it's retried (like 500/502/503)
before classification.

**Reason granularity:** A new `reasonForClientOrServerError()` helper
assigns descriptive reasons (`server_error`, `rate_limited`, `transient`,
`auth_required`, `forbidden`, `client_protocol`, `client_error`) so logs
can distinguish "the server was broken" from "we were rate-limited."

**Legacy inference sync:** `normalizeStatus()` in `lib/utils/broken-link.ts`
(the fallback path for bookmarks without a `broken_status` column) now
mirrors the new rules — 5xx and transient 4xx infer to `unknown`, not
`confirmed_broken`.

**UI messages:** `getBrokenLinkMessage()` now returns clearer text for
429 ("Rate limited (try again later)") and 408 ("Request timed out")
instead of generic "Error (429)".

### 1.2 Soft-404 detection — precision tiers

**Files:** `lib/link-health/checker.ts`, `lib/__tests__/link-health.test.ts`

The previous design gated every soft-404 signal on a single 4 KB body
threshold. This disabled the highest-precision signals (canonical → /404,
error-page CSS class, JSON error payload) on large CMS-generated 404 pages
— the exact sites whose 404s are richest (8–20 KB with nav/footer/chrome).

**New tiered design:**

| Tier       | Signals                                                    | Body-size gate            | Reason                                                           |
| ---------- | ---------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| 1 (HIGH)   | canonical → /404, error-page CSS class, JSON error payload | None (fires regardless)   | `soft404_canonical`, `soft404_error_class`, `soft404_json_error` |
| 2 (MEDIUM) | title is 404-shaped AND body keyword present               | < 8 KB (raised from 4 KB) | `soft404_combined`                                               |
| Negative   | body > 64 KB                                               | Suppresses all signals    | —                                                                |

**Removed (net FP sources):**

- `soft404_body_keyword` (keyword-only, short body) — tripped on short
  pages that mention "not found" in non-404 contexts (e.g. "item not in
  stock", "section not found in config").
- `soft404_title` (title-only, short body) — rarely correct in practice;
  most real soft-404s have descriptive titles like "Page Not Available."
- `soft404_empty_body` (< 200 bytes) — evaluated and removed during
  testing: it produced false positives on legitimate short responses
  (minimal HTML, small JSON API payloads, "ok" confirmation bodies).

**Dead code removed:** `SOFT_404_BODY_LENGTH_THRESHOLD` constant (4 KB)
is no longer referenced and was deleted.

### 1.3 GET-primary evaluation — decision to keep HEAD-with-fallback

**Documented in:** `lib/link-health/checker.ts` module docstring.

The design review (§2 R-I) evaluated switching to GET-primary (lychee's
approach) to eliminate the HEAD→GET fallback machinery and make the
soft-404 probe a no-op. **Decision: keep HEAD-with-fallback.**

Rationale:

- The HTTP classification fixes (§1.1) and tiered soft-404 (§1.2) deliver
  the bulk of the FP/FN reduction without the migration risk.
- GET-primary is a larger refactor (~80 lines removed) that would
  invalidate many existing tests and change the bandwidth profile
  (~0.5 KB HEAD → ~50 KB GET per check × 500 checks/run = 25 MB/run).
- The current approach is stable, well-tested, and the HEAD→GET fallback
  correctly handles the 405/403 cases that motivated it.
- GET-primary remains a candidate for a future dedicated refactor; it
  would also fix R-J (finalUrl discarded by the soft-404 probe).

### 1.4 Documentation updates

- `lib/link-health/checker.ts` module docstring updated with HTTP
  classification semantics and the GET-primary decision rationale.
- Inline comments reference the design review (`docs/broken-link-detection
-design-review.md §2 R-D, R-E, R-F, R-G`) for full RFC citations.

---

## 2. Why

These changes address the two highest-impact false-positive sources
identified in the design review's threat model (§4):

1. **Deploy blip → red for a week.** A 5-minute 500 during a deploy was
   painted red until the next weekly cron (7 days). Now it's amber
   (`unknown server_error`) and self-heals on the next run.

2. **Large soft-404 → alive forever.** CMS 404 pages with full
   nav/footer (> 4 KB) escaped detection because the gate disabled the
   highest-precision signals. Now canonical/error-class/JSON signals
   fire regardless of body size.

The changes also address two smaller FP classes:

- **Rate-limited hosts** (429) no longer show red.
- **504 Gateway Timeout** is now retried before classification.

All changes preserve the 4-state machine (`alive` / `confirmed_broken` /
`likely_broken` / `unknown`) and the deterministic weekly-overwrite
discipline. No new states, no escalation ladders, no confidence scoring,
no telemetry — per the scoped requirement.

---

## 3. Test coverage added

### 3.1 Existing tests updated (`lib/__tests__/link-health.test.ts`)

- `classifyByHttpStatus`: 5xx now asserts `unknown` (was `confirmed_broken`).
- New tests for transient 4xx (408/425/429 → `unknown`).
- New tests for client/protocol 4xx (405/406/415/416/421/426/428/431 → `unknown`).
- New tests for authoritative-absence 4xx (400/404/409/412/422 → `confirmed_broken`).
- Soft-404 tests rewritten for the tiered design: large soft-404 with
  canonical now asserts `likely_broken` (was `alive`); large soft-404 with
  error-page CSS class now asserts `likely_broken` (was `alive`).
- Integration tests: HEAD 5xx now asserts `unknown` (was `confirmed_broken`);
  new tests for 429 and 408 integration paths.

### 3.2 Existing tests updated (`lib/__tests__/utils-extra.test.ts`)

- `getBrokenLinkMessage(429)` now asserts "Rate limited (try again later)".
- New test for `getBrokenLinkMessage(408)` ("Request timed out").
- `getBrokenLinkMessage(400)` test added for coverage of generic 4xx path.

### 3.3 New E2E test file (`lib/__tests__/link-health-e2e.test.ts`)

30 integration tests covering the documented state machine and decision
tree, organized by scenario category:

| Category             | Tests | Scenarios                                                                      |
| -------------------- | ----- | ------------------------------------------------------------------------------ |
| 2xx responses        | 6     | alive, soft-404 (combined, canonical, error-class, JSON), long article (no FP) |
| Redirects            | 3     | 301→200, 301→404, redirect loop                                                |
| 4xx responses        | 8     | 404, 410, 451, 401, 429, 408, 405→GET, 403→GET-403                             |
| 5xx responses        | 3     | 500, 503, 504 (all `unknown`)                                                  |
| Network errors       | 4     | timeout, DNS, TLS, connection refused                                          |
| Always-alive domains | 4     | twitter.com, subdomain, youtube.com, path-segment non-match                    |
| Login walls          | 2     | 200 login interstitial, 200 Cloudflare challenge                               |

### 3.4 Test results

```
Test Files  8 passed (8)
Tests       173 passed (173)
```

- `lib/__tests__/link-health.test.ts`: 60 tests (was 50, +10)
- `lib/__tests__/link-health-e2e.test.ts`: 30 tests (new)
- `lib/__tests__/http-fetch.test.ts`: 23 tests (unchanged)
- `lib/__tests__/utils-extra.test.ts`: 39 tests (was 37, +2)
- All other test files: unchanged, passing.

Lint (`biome check`): clean. Typecheck (`tsc --noEmit`): clean.

---

## 4. Design decisions intentionally unchanged

Per the scoped requirement, the following were evaluated but **not
changed**:

1. **4-state machine preserved.** No fifth state, no escalation ladders,
   no confidence scoring, no telemetry. All improvements are in
   classification rules and soft-404 heuristics.

2. **HEAD-with-fallback kept** (see §1.3). GET-primary is a candidate for
   a future dedicated refactor.

3. **Always-alive synthetic `http_status=200` kept.** The design review
   flagged this as an honesty violation (R-A recommends `http_status=NULL`
   with `reason='always_alive'`). This is a one-line fix with zero
   behavioral risk, but it was outside the scoped "high-impact
   improvements" and touches the persistence layer — deferred to avoid
   scope creep.

4. **Weekly overwrite discipline preserved.** No sticky states, no
   skip-once-seen-broken logic, no consecutive-failure counter. A
   transient misclassification self-heals on the next run.

5. **No persistence of `reason`.** The `reason` field is returned by
   `checkUrl` but not written to the DB (the persist call in
   `scripts/check-urls.ts` writes only `is_broken`, `broken_status`,
   `http_status`, `last_checked_at`). Persisting `reason` would require
   a migration and is a prerequisite for the escalation ladder / confidence
   scoring features explicitly excluded from this scope.

6. **Manual redirect loop detection (dead code) not removed.** The
   `followRedirectsManually` function in `http-fetch.ts` and the
   `too_many_redirects` / `redirect_loop` error reasons in
   `classifyFetchError` are technically dead code on the cron path
   (which uses native auto-follow). They were not removed because (a) they
   are used by the `followRedirect: { maxHops }` mode which other callers
   may use, and (b) removing them is a cleanup task unrelated to the
   classification fixes.

7. **Soft-404 empty-body heuristic not shipped.** A tier-3 heuristic
   flagging bodies < 200 bytes as `soft404_empty_body` was implemented
   and tested, then **removed** because it produced false positives on
   legitimate short responses (minimal HTML, small JSON API payloads,
   "ok" confirmation bodies). The tier-1/2 signals are sufficient and
   high-precision; the empty-body heuristic was net-negative.

---

## 5. Files changed

| File                                    | Change                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/link-health/checker.ts`            | HTTP classification (5xx/transient → unknown); soft-404 tiered design; `reasonForClientOrServerError` helper; module docstring; dead constant removed |
| `lib/utils/http-fetch.ts`               | `504` added to `DEFAULT_RETRY_STATUSES`                                                                                                               |
| `lib/utils/broken-link.ts`              | `normalizeStatus` syncs with new classification; `getBrokenLinkMessage` clearer for 429/408                                                           |
| `lib/__tests__/link-health.test.ts`     | Updated classification assertions; rewritten soft-404 tests for tiers                                                                                 |
| `lib/__tests__/link-health-e2e.test.ts` | New: 30 E2E state-machine tests                                                                                                                       |
| `lib/__tests__/utils-extra.test.ts`     | Updated message assertions for 429/408                                                                                                                |

---

_End of implementation report. For the full design rationale and RFC
citations, see `docs/broken-link-detection-design-review.md`. For the
implementation audit with `file:line` provenance, see
`docs/broken-link-detection-audit.md`._
