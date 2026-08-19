# Broken-Link Detection — Design Review

> A **design review**, not a code audit. The companion audit
> (`docs/broken-link-detection-audit.md`) already reconstructs the implementation
> with `file:line` provenance. This document evaluates the _design_ of that
> implementation against HTTP RFCs, browser behavior, and industry link
> checkers, then proposes a production-grade target with measurable confidence.
>
> Scope: every classification rule, the real-world scenario matrix, the
> FP/FN threat model, extensibility for future features, and a prioritized
> roadmap. The goal is a **simple, deterministic, defensible** classifier —
> not a research project.

---

## 0. Method & Reference Framework

Every claim below is grounded in one of:

- **RFC 9110** (HTTP Semantics, 2022; obsoletes RFC 7230–7235) — the
  authoritative status-code semantics.
- **RFC 9111** (HTTP Caching) — 304, `Cache-Control`, `Retry-After`.
- **RFC 6585** — additional 4xx codes (429, 408-style semantics).
- **RFC 7725** — status code 451 (legal).
- **RFC 7538** — status code 308.
- **RFC 8020** — NXDOMAIN semantics ("There Really Is Nothing Under Here").
- **Browser behavior** — what Chrome/Firefox/Safari actually render for a
  given status (the user's ground truth for "is this link broken?").
- **Industry link checkers**, primarily:
  - **lychee** (the de-facto GitHub Actions link checker) — defaults at
    `lychee.cli.rs/guides/cli`. Default method: GET. Default accept:
    `100..=103, 200..=299`. Default retries: 3. Default timeout: 20s.
  - **Google Search Console** — coined "soft 404" in 2010
    (`developers.google.com/search/blog/2010/06/crawl-errors-now-reports-soft-404s`).
  - **W3C link checker**, **Screaming Frog**, **Ahrefs**, **DubBot** —
    commercial SEO crawlers; their public docs are the industry baseline.

### 0.1 The foundational distinction the current design blurs

A status code is a statement about **one HTTP transaction**. A "broken link"
verdict is a statement about **a resource**. These are not the same thing:

| Status | RFC meaning (transaction)                                                                      | Resource verdict (interpretation)                      |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 404    | Target resource not found _for this request_                                                   | Almost always "resource gone"                          |
| 410    | Resource permanently, intentionally removed                                                    | "Resource gone" (highest confidence)                   |
| 503    | Server temporarily overloaded (RFC 9110 §15.6.4: "will likely be alleviated after some delay") | **NOT** "resource gone" — server-side transient        |
| 429    | Client sent too many requests (RFC 6585 §4)                                                    | **NOT** "resource gone" — client-side transient        |
| 511    | Captive portal requires auth (RFC 6585 §6)                                                     | **NOT** "resource gone" — network-level captive portal |

The current implementation collapses transaction-level failures into
resource-level verdicts in several places — most aggressively for 5xx, 429,
408, and 511. This is the single largest source of avoidable false positives
and the throughline of §2.

### 0.2 What "production-grade" means here

A link-health classifier is production-grade when it satisfies, with
**measurable** evidence:

1. **Spec-correctness.** No status code is classified in a way that contradicts
   its RFC-defined semantics. (Today: 429, 408, 425, 504, 511 violate this —
   see §2.)
2. **Honesty.** The persisted `http_status` field reflects an actual HTTP
   response, never a synthetic value. (Today: always-alive domains write
   `http_status=200` with no HTTP request — a lie. See R-A.)
3. **FP rate.** Measurable, with a per-`reason` breakdown so regressions are
   visible. (Today: `reason` is not persisted — see §5.)
4. **FN rate.** Bounded by a known ceiling for each FN class, with documented
   tradeoffs.
5. **Determinism.** For a fixed fetch outcome, the verdict is a pure function
   of inputs. (Today: ✓ — preserved by §7.)
6. **Reversibility.** A transient misclassification self-heals on the next run
   without human action. (Today: ✓ for the four states; ✗ for the synthetic
   always-alive `http_status=200`.)

The roadmap (§6) is prioritized to move the current implementation from
"defensible" to "production-grade" on all six axes.

---

## 1. Industry Comparator Reference Card

How the current implementation compares to its peers. "Default" = out-of-the-box
behavior without user-tuned accept lists.

| Dimension               | lychee (GitHub Actions default)                   | Google Search Console          | W3C checker        | **Sheltermark (current)**                        |
| ----------------------- | ------------------------------------------------- | ------------------------------ | ------------------ | ------------------------------------------------ |
| Primary method          | **GET** (no HEAD)                                 | GET (crawler)                  | HEAD, GET fallback | HEAD, GET fallback on 405/403                    |
| Default "OK" status set | `100..=103, 200..=299`                            | (content-based)                | 2xx                | 2xx (after soft-404 probe)                       |
| Treatment of 429        | Error by default (binary); `--accept 429` opts in | —                              | —                  | `confirmed_broken` after retry                   |
| Treatment of 5xx        | Error (retried 3×); `--accept 500` opts in        | —                              | —                  | `confirmed_broken` after retry (504 NOT retried) |
| Treatment of 401/403    | Error                                             | Treats as accessible           | Reports as warning | `unknown` (with GET fallback on 403)             |
| Soft-404 detection      | **None**                                          | ML/content model (proprietary) | None               | Multi-signal, body-size gated                    |
| Retry count             | 3                                                 | (crawler queue, days)          | —                  | 2                                                |
| Timeout                 | 20 s                                              | (crawler budget)               | 30 s               | 10 s                                             |
| Max redirects           | 10 (manual control)                               | (crawler, ~30)                 | (manual control)   | Runtime-native (uncontrolled)                    |
| Per-host throttle       | Yes (`--host-concurrency 10`, adaptive)           | (crawler politeness)           | —                  | Yes (1 concurrent/host, hard)                    |
| Caching across runs     | Yes (`.lycheecache`, `--cache-exclude-status`)    | —                              | —                  | **No** (every run overwrites)                    |
| Bot-detection awareness | None                                              | (retries via crawler)          | None               | None (always-alive allowlist instead)            |
| Soft-404 status output  | N/A                                               | Reports in Search Console      | N/A                | `reason` returned but **not persisted**          |

**Three industry signals worth highlighting:**

1. **lychee uses GET, not HEAD.** This sidesteps the entire HEAD-405/403
   fallback machinery. The cost is bandwidth; the benefit is correctness —
   GET returns the resource a browser would actually see, so soft-404
   detection has the right input.
2. **lychee treats 429/5xx as "error" by default** — but binary. Sheltermark's
   4-state model is _richer_ than lychee's; the gap is that Sheltermark puts
   429/5xx in the _wrong_ rich state (`confirmed_broken`) instead of
   `unknown`.
3. **No commercial link checker persists synthetic `200`s for walled gardens.**
   lychee has `--exclude` (skip); Google crawls the page for real. Sheltermark's
   always-alive short-circuit (writing `http_status=200` without an HTTP
   request) is an idiosyncratic choice with no industry precedent.

---

## 2. Classification Rule Critique

For each rule in the audit (§5 R-A through R-J) plus implicit rules surfaced
by this review: **why it exists**, **RFC/browser/industry basis**,
**optimal?**, and **better heuristic**. Each ends with a verdict tag:
`KEEP`, `FIX`, `REPLACE`, or `REMOVE`.

---

### R-A. Always-alive short-circuit → `alive` with synthetic `http_status=200`

**Why it exists.** Walled-garden platforms (Twitter, YouTube, Instagram,
TikTok, Facebook) reject automated HEAD/GET with 401/403 or serve JS-only
challenge pages. A naive check would mark every tweet as broken.

**RFC basis.** None — this is a deliberate bypass of HTTP.

**Browser behavior.** Browsers fetch these URLs and render them. A deleted
tweet renders a "this Tweet was deleted" page; an unlisted YouTube video
shows "Video unavailable." Browsers do _not_ bypass.

**Industry comparator.**

- lychee: `--exclude` regex skips the URL entirely; it does not classify the
  link as OK. The link is reported as "excluded," not "alive."
- Google: crawls normally; uses platform APIs and structured data to verify.
- No industry tool writes a synthetic `200` for a URL it never fetched.

**Optimal?** **No.** Two distinct defects:

1. **Honesty violation.** `http_status=200` is persisted for an HTTP request
   that never happened. This breaks the invariant that `http_status` reflects
   an actual response. Any downstream consumer (debugging, analytics,
   confidence scoring) is lied to.
2. **Confidence inflation.** The verdict says "alive" with the same confidence
   as a real 2xx. A deleted tweet and a live tweet are indistinguishable —
   forever. The FN rate on these domains is unbounded and unmeasurable.

**Better heuristic (in priority order):**

1. **Stop lying about `http_status`.** When short-circuiting, persist
   `http_status=NULL` with `reason='always_alive'`. The verdict stays `alive`
   (UI semantics unchanged), but the field is honest.
2. **Downgrade the verdict to `unknown` with `reason='walled_garden'`.** This
   is the epistemically honest classification: we cannot verify the resource.
   The UI cost is small (amber vs. hidden); the trust gain is large.
3. **Long-term: use the platform's verification API.** YouTube has oEmbed
   (`https://www.youtube.com/oembed?url=...`); Twitter has the embedded-tweet
   endpoint; Instagram has the embed iframe. A 200 from oEmbed is a real
   signal that the resource exists. A 404 from oEmbed is a real signal it's
   gone. (See §6 P2.)

**Verdict: FIX (immediate) → REPLACE (long-term via oEmbed).**

---

### R-B. 401 / 403 → `unknown` (with 403 HEAD → GET fallback)

**Why it exists.** On a public URL, 401/403 usually mean bot-detection or
auth-walling, not "gone." ADR-0002 codified the conservative `unknown` over
false-positive `confirmed_broken`.

**RFC basis.**

- **401 Unauthorized** (RFC 9110 §15.5.1): "the request lacks valid
  authentication credentials." The server **MUST** include a `WWW-Authenticate`
  response header. **Absence of `WWW-Authenticate` on a 401 is a spec
  violation** and a strong signal of bot-detection masquerading.
- **403 Forbidden** (RFC 9110 §15.5.3): "the server understood the request but
  refuses to authorize it." Distinct from 401: the server is _refusing_, not
  _asking for auth_. 403 says nothing about whether the resource exists.

**Browser behavior.** 401 → browser shows a native auth prompt; 403 → browser
shows "Forbidden" page. Neither renders as "broken" in the way 404 does.

**Industry comparator.**

- lychee: both are "error" (binary).
- Google: treats both as accessible (no special-casing).
- DubBot public docs: 401 = "password protected," 403 = "forbidden" — neither
  flagged as broken.

**Optimal?** **Partly.** The 403 HEAD → GET fallback is a smart recovery (T7,
R-I). The blind `unknown` for both loses signal that the RFC and modern
infrastructure make detectable:

- A **403 with `Server: cloudflare`** + `cf-mitigated: challenge` header is
  _definitively_ a bot-challenge, not a real refusal.
- A **403 with HTML body "Just a moment...", "Checking your browser...", or
  "Enable JavaScript and cookies to continue"** is a Cloudflare/Akamai/Imperva
  interstitial.
- A **401 without `WWW-Authenticate`** is a spec violation, almost always a
  misconfigured bot-detection layer.

**Better heuristic:**

```
401 + WWW-Authenticate         → unknown, reason='auth_required'
401 + no WWW-Authenticate      → unknown, reason='bot_challenge_suspected'
403 + cf-mitigated header      → unknown, reason='bot_challenge_cloudflare'
403 + Server: cloudflare       → unknown, reason='bot_challenge_cloudflare'
403 + "Just a moment" body     → unknown, reason='bot_challenge_interstitial'
403 + none of the above       → fallback_to_get (current behavior)
```

The current `unknown` is correct for the default branch; the refinement adds
_reason_ discrimination that makes FP debugging and confidence scoring
possible.

**Verdict: KEEP + ADD signal discrimination (P1).**

---

### R-C. 410 / 451 → `confirmed_broken` with `reason='gone'`

**Why it exists.** Both codes are explicit "deliberately gone" signals.

**RFC basis.**

- **410 Gone** (RFC 9110 §15.5.11): "the target resource no longer has a
  current representation and that this condition is likely permanent ...
  primarily used to assist the task of web maintenance by notifying the
  recipient that the resource is intentionally unavailable." **Strongest
  "gone" signal in the spec.**
- **451 Unavailable For Legal Reasons** (RFC 7725 §3): "the server is denying
  access to the resource as a consequence of a legal demand." RFC explicitly
  notes the resource may still exist — access is denied, not the resource
  removed. RFC 7725 §5 defines an optional `Link: rel="blocked-by"` header
  that identifies the blocking entity.

**Browser behavior.** Both render as error pages; 451 is increasingly shown
with a legal-notice variant.

**Industry comparator.** lychee treats both as error (binary). Google treats
410 as a permanent removal signal (drops from index).

**Optimal?**

- **410: Yes.** Spec-perfect. Keep.
- **451: Debatable.** The resource may exist in other jurisdictions; the
  user's bookmark is from their perspective. If the user's region sees 451,
  the link is _effectively_ broken for them — current behavior is defensible.
  The refinement is to capture the legal context (the `Link` header) so the
  user can distinguish "gone" from "legally blocked."

**Better heuristic:**

```
410                            → confirmed_broken, reason='gone'
451                            → confirmed_broken, reason='legal_block'
451 + Link: rel="blocked-by"   → confirmed_broken, reason='legal_block',
                                 blocked_by=<entity>
```

**Verdict: KEEP (410 perfect; 451 add metadata).**

---

### R-D. 5xx → `confirmed_broken` (retried only for 500/502/503)

**Why it exists.** Conservative: server-side failure on a public URL is
treated as resource failure.

**RFC basis.**

- **500 Internal Server Error** (§15.6.1): "the server encountered an
  unexpected condition that prevented it from fulfilling the request."
  Ambiguous: could be transient (deploy crash) or permanent (broken route
  handler).
- **502 Bad Gateway** (§15.6.2): upstream invalid response. Usually
  transient (upstream restart, deploy).
- **503 Service Unavailable** (§15.6.4): "the server is currently unable to
  handle the request due to a temporary overload or scheduled maintenance,
  **which will likely be alleviated after some delay**." Spec-explicit
  transient. SHOULD send `Retry-After`.
- **504 Gateway Timeout** (§15.6.5): upstream timeout. Often transient.
- **511 Network Authentication Required** (RFC 6585 §6): **captive portal**.
  The server is a captive-portal gateway requiring login — the resource is
  fine; the _network_ the client is on is intercepting traffic.

**Browser behavior.** 5xx shows an error page; user can refresh. 511 shows a
captive-portal login page.

**Industry comparator.**

- lychee: 5xx is "error" (binary) but retried; `--accept 500` opts in.
- Google: 5xx triggers re-crawl later; not a removal signal.

**Optimal?** **No — this is the largest spec-violation in the design.**

| Code        | Spec says                       | Current does                      | Verdict                                                        |
| ----------- | ------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| 500         | Ambiguous                       | retry → `confirmed_broken`        | Should be `unknown` after retry (server error ≠ resource gone) |
| 502         | Usually transient               | retry → `confirmed_broken`        | Should be `unknown` after retry                                |
| 503         | Spec-explicit transient         | retry → `confirmed_broken`        | **Spec violation** — should be `unknown`                       |
| 504         | Often transient                 | **NO retry** → `confirmed_broken` | **Spec violation + retry miss**                                |
| 511         | Captive portal (network issue)  | retry → `confirmed_broken`        | **Spec violation** — should be `unknown captive_portal`        |
| 501         | Server doesn't implement method | → `confirmed_broken`              | Debatable; method-not-implemented ≠ resource gone              |
| 507/508/510 | Rare server conditions          | → `confirmed_broken`              | Fine                                                           |

The core mistake: **5xx means "I (server) couldn't handle this request," not
"the resource doesn't exist."** A server-side Django traceback at 3am does not
mean the bookmarked URL is dead — it means the server is broken right now.

**Better heuristic:**

```
5xx after retry exhaustion       → unknown, reason='server_error'
503 + Retry-After                → honor Retry-After (cross-run backoff)
511                              → unknown, reason='captive_portal' (no retry)
501                              → unknown, reason='not_implemented'
```

The 5xx → `unknown` change is the single highest-impact FP fix in this review.
A persistent 5xx across N weekly runs can escalate via the ladder in R-H.

**Note on confidence.** A `confirmed_broken` 5xx says "this resource is gone"
with red severity. An `unknown server_error` says "we couldn't verify" with
amber. The latter is honest. The user's loss: a few weeks of amber on a
genuinely broken server. The user's gain: no more red-on-Monday for a Sunday
deploy that crashed at 11pm.

**Verdict: FIX (P0 — highest impact).**

---

### R-E. Other 4xx → `confirmed_broken`

**Why it exists.** 404 is authoritative absence; the rule generalizes to the
4xx class.

**RFC basis.** 4xx is "client error" per RFC 9110 §15.4 — but the class is
**heterogeneous**. Specific codes:

| Code                                | RFC meaning                              | "Resource gone?"                          |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------- |
| 400 Bad Request                     | Malformed request                        | No — client error                         |
| 404 Not Found                       | Target resource not found                | **Yes** (authoritative)                   |
| 405 Method Not Allowed              | Method not supported (MUST send `Allow`) | No — method issue                         |
| 406 Not Acceptable                  | `Accept` header constraints can't be met | No — client negotiated wrong content type |
| 408 Request Timeout                 | Client didn't respond in time            | No — transient                            |
| 409 Conflict                        | State conflict                           | No — usually concurrent-modification      |
| 411 Length Required                 | Missing `Content-Length`                 | No — client error                         |
| 412 Precondition Failed             | `If-*` header failed                     | No — client error                         |
| 413/414/415/416/417                 | Request entity issues                    | No — client error                         |
| 421 Misdirected Request             | Wrong server connection                  | No — transient                            |
| 422 Unprocessable Content           | Semantic violation in request            | Debatable                                 |
| 425 Too Early                       | 0-RTT TLS replay risk                    | No — transient                            |
| 426 Upgrade Required                | Must use different protocol              | No — client protocol issue                |
| 428 Precondition Required           | Must send precondition                   | No — client error                         |
| 429 Too Many Requests               | Rate limit                               | No — **spec-explicit transient**          |
| 431 Request Header Fields Too Large | Header too big                           | No — client error                         |

**Browser behavior.** Only 404 and 410 render as "page not found." 400, 406,
415 typically show "bad request" — clearly not "this page is gone."

**Industry comparator.**

- lychee: all 4xx are "error" by default (binary).
- Google: 404 is a removal signal; 429/408 trigger re-crawl; 4xx otherwise is
  treated as content issue.

**Optimal?** **No — the heterogeneous 4xx class needs splitting.** Current
mapping:

```
confirmed_broken: 400, 402, 404, 405(post-fallback), 406, 409, 412-418, 421-428, 431
unknown:          401, 403(post-fallback), 429(after retry)
gone:             410, 451
```

Should be:

```
confirmed_broken: 404                                  # authoritative absence
confirmed_broken: 400, 409, 412, 422                   # request/resource conflict — debatable but defensible
unknown:           405(post-fallback, GET not in Allow) # method issue
unknown:           406, 415, 416                        # client misnegotiated — fix the client, not the verdict
unknown:           408, 425, 429                        # spec-explicit transient
unknown:           421, 426, 428, 431                   # client/protocol-level transient
gone:              410, 451                             # explicit
```

The most impactful sub-fix: **406 and 415 mean "you asked for the wrong
content type."** The correct response is to retry once with a different
`Accept` header (e.g., `Accept: */*`), not to mark the link broken. A
bookmark that returns 406 on `Accept: text/html` because the server only
serves `application/pdf` is alive — the bookmark metadata fetcher should
just adapt.

**Verdict: FIX (split the 4xx class; retry 406/415 with adjusted Accept).**

---

### R-F. Soft-404 short-body gate (<4 KB)

**Why it exists.** Real content pages are usually >4 KB; the gate kills the
FP class of articles that merely _discuss_ 404s (e.g., a blog post titled
"Why 404 pages matter" that mentions "page not found" repeatedly).

**RFC basis.** None — soft-404 is a Google Search Console concept, not an RFC
term. Google's definition: "A soft 404 occurs when a webserver responds with a
200 OK HTTP response code for a page that doesn't exist rather than the
appropriate 404 Not Found."

**Browser behavior.** Renders the 200 page regardless of body size.

**Industry comparator.**

- lychee, W3C, Screaming Frog: no soft-404 detection (binary status-based).
- Google: ML/content model, proprietary. Reportedly uses features including
  body length, presence of search boxes, "page not found" text, empty
  templates, and template-matching against known CMS 404 templates.

**Optimal?** **No — the gate disables the strongest signals.** Two defects:

1. **High-precision signals are gated behind a low-precision threshold.** The
   `canonical → /404` and `error-page` CSS class signals are _high-precision_
   (a real article almost never has `<link rel="canonical" href="/404">`).
   Gating them on body size kills true positives on large CMS-generated 404
   pages (which are often >4 KB due to header/footer/nav).

2. **The 4 KB threshold is arbitrary.** A custom 404 page from a SaaS app can
   easily be 8–20 KB (Tailwind, React, font preload). The body-length gate
   fails precisely on the sites most likely to have rich soft-404 pages.

**Better heuristic — decouple precision tiers:**

```
Tier 1 (HIGH precision — fire regardless of body size):
  - canonical → /404, /not-found, /page-not-found
  - error-page | page-404 | not-found-page | page-not-found CSS class
  - JSON error payload (already short-body gated — keep)

Tier 2 (MEDIUM precision — fire if body < 8 KB OR empty):
  - title is exactly "404" or matches /not\s*found/i
  - body keyword "page not found" + canonical self-reference absent

Tier 3 (LOW precision — require short body < 2 KB):
  - body keyword alone
  - title alone

Tier 4 (NEGATIVE — actively argues alive, suppresses soft-404):
  - canonical self-reference (href == request URL)
  - OpenGraph og:title present and non-empty
  - body > 64 KB (real article)
```

The current implementation conflates all four tiers under one threshold. The
fix preserves the _spirit_ of the gate (kill keyword-only FPs on real
articles) while letting high-precision signals fire on large soft-404s.

**Verdict: FIX (P0 — decouple precision tiers).**

---

### R-G. Soft-404 keyword-only / title-only (short body)

**Why it exists.** Either signal alone is weak; combined
(`soft404_combined`) is the trusted rule. Singletons kept as weaker fallbacks.

**RFC/browser/industry.** As above (R-F).

**Optimal?** **No.** The singleton branches are net-negative:

- `soft404_body_keyword` alone fires on any short page mentioning "not found"
  — a 200-byte "404 Not Found — try the search" message on a real 404 is
  correct, but a 200-byte "Item not found in stock" product page is a FP.
- `soft404_title` alone fires on any short page with `<title>404</title>` —
  rare in practice (most real soft-404s have descriptive titles like "Page
  Not Available"), so the branch is both noisy and rarely correct.

**Better heuristic.** Drop both singleton branches. Require either:

- Tier-1 signal (canonical, error-class, JSON), OR
- Tier-2 combo: title + body keyword, with body < 8 KB, OR
- Empty-body heuristic: body < 200 bytes on a 2xx is suspicious on its own.

This removes two FP-prone branches and keeps the high-precision paths.

**Verdict: REMOVE singleton branches (P1).**

---

### R-H. Network errors → `unknown`, no escalation

**Why it exists.** The pre-ADR-0002 design collapsed every throw into
`is_broken=false` (alive) — a timeout looked healthy forever. ADR-0002 moved
throws to `unknown`. The deliberate trade: "never make false claims."

**RFC basis.** None — `unknown` is not an HTTP concept, it's an epistemic
classification. However, RFC 8020 codifies DNS NXDOMAIN as authoritative
"this name does not exist," which informs the escalation ladder below.

**Browser behavior.** Chrome shows "This site can't be reached" /
"DNS_PROBE_FINISHED_NXDOMAIN" / "ERR_CONNECTION_REFUSED." The browser makes
no claim about whether the resource exists.

**Industry comparator.**

- lychee: network errors are "error" (binary).
- Google: retries via crawler queue over days/weeks; persistent DNS failure
  eventually drops from index.

**Optimal?** **For a single run, yes.** **For repeated runs, no.** The audit
(§6 #3) flagged this; the refinement here is to make the escalation
_deterministic_ and _spec-justified_:

A DNS **NXDOMAIN** is a strong signal. RFC 8020 ("NXDOMAIN: There Really Is
Nothing Under Here") codifies that an authoritative NXDOMAIN means the name
does not exist in the DNS. A domain that returns NXDOMAIN for 4 consecutive
weekly checks (28 days) is, with very high probability, **dead** — registrars
drop domains after a grace period, and a registrant who let it lapse for a
month is not coming back.

A **TLS failure** is weaker — the cert may renew, the server may upgrade.
A **connection refused** is weakest — could be a firewall rule, could be a
crashed daemon.

**Better heuristic — per-failure-mode escalation:**

```
After N consecutive weekly unknowns:

DNS NXDOMAIN     (N >= 4)   → confirmed_broken, reason='dns_nxdomain_persistent'
                              (strong: RFC 8020 + registrar lifecycle)

TLS failure      (N >= 8)   → confirmed_broken, reason='tls_persistent'
                              (weak: cert might renew; long window)

Connection       (N >= 8)   → confirmed_broken, reason='unreachable_persistent'
refused/reset                (medium: server genuinely down)

Timeout          (N >= 8)   → stay unknown, but surface in UI as
                              "unreachable for N weeks" (still not red)

Bot challenge    (never)     → stay unknown forever (the platform is up;
                              our check is blocked)
```

The key discipline: **escalation is per-reason, not per-state.** A
`unknown rate_limited` should never escalate to `confirmed_broken` — the
resource is fine. A `unknown dns_nxdomain` should escalate because the
_domain_ is gone. Persisting `reason` (audit §6 #9) is a prerequisite.

**Verdict: KEEP single-run behavior; ADD per-reason escalation ladder (P1).**

---

### R-I. HEAD → GET fallback only on 405 / 403

**Why it exists.** Some servers/CDNs reject HEAD with 403/405; a real GET
usually works. The fallback recovers these to a real classification.

**RFC basis.**

- **405 Method Not Allowed** (RFC 9110 §15.5.5): the server MUST return an
  `Allow` header listing valid methods. If `Allow: GET, HEAD` is present, the
  server explicitly supports GET — HEAD rejection is a server bug.
- **403 on HEAD specifically** has no RFC meaning distinct from 403 on GET;
  it's an empirical observation that some CDNs (Cloudflare, Akamai) treat
  HEAD as suspicious.

**Browser behavior.** Browsers always use GET for navigation; HEAD is a
tool-only verb. So GET is the ground truth.

**Industry comparator.**

- **lychee uses GET by default and skips the HEAD-vs-GET question entirely.**
- W3C checker: HEAD with GET fallback (same as Sheltermark).

**Optimal?** **Partly.** The fallback triggers correctly on 405/403 but misses:

1. **HEAD 401** is not given a GET fallback (T12 → `unknown`), even though GET
   might return 200 (cookies, different auth path). Inconsistent with 403.
2. **HEAD 400/406/415** (client-side method-specific errors) — these are
   technically "server says your HEAD was malformed," which is rare but real.
   A GET would clarify whether the resource exists.
3. The fundamental issue: **HEAD is an optimization, not a correctness
   mechanism.** It saves bandwidth but introduces a whole fallback state
   machine that wouldn't exist if GET were the primary method.

**Better heuristic (two options):**

- **Option A (lychee-style):** Switch primary method to GET. Delete the
  fallback machinery. Cost: more bandwidth (~average page ~50 KB vs. HEAD
  ~0.5 KB). Benefit: correctness, simpler state machine, soft-404 probe is
  no longer a separate request (the response body is already in hand).
- **Option B (incremental):** Keep HEAD as primary but extend fallback to
  _all_ 4xx where GET might behave differently (401, 405, 406, 415). Keep 403
  fallback.

For a bookmark manager (low volume, weekly cadence, ~500/run), **Option A
is strongly preferred.** The bandwidth cost is trivial (~25 MB/run worst case)
and the simplification is substantial: the HEAD→GET fallback code, the
soft-404 probe (which becomes a no-op — the GET body is already fetched), and
the dead manual-redirect machinery all collapse.

**Verdict: REPLACE (switch to GET-primary; P1).**

---

### R-J. `finalUrl` discarded + soft-404 probe on original URL

**Why it exists (incidental).** The orchestrator only consumes `response`;
`finalUrl` is unused. The soft-404 probe re-GETs the original URL.

**RFC basis.** RFC 9110 §15.4 defines redirect semantics; the `Location`
header on 3xx points at the new resource. After following redirects, the
_resource_ is at `response.url`, not the original URL.

**Browser behavior.** Browsers display the final URL after redirects; the
address bar shows `response.url`. If a user bookmarks `example.com/old` and
it redirects to `example.com/parked`, the user's browser shows the parked
page. The link is effectively broken from the user's perspective.

**Industry comparator.** lychee evaluates the final URL. Google evaluates
the final URL. No tool re-fetches the original URL after a redirect chain.

**Optimal?** **No.** Two distinct problems:

1. **Wasted request.** The soft-404 probe re-GETs the original URL, which
   re-follows the redirect chain. Two full redirect chains per check.
2. **Wrong assessment.** A redirect to a parked/404 page is assessed against
   the _original_ URL — but the soft-404 body comes from the _redirect
   target_. If the target serves a soft-404 body, the canonical/CSS/title
   signals all come from the target — but the probe re-fetches the original,
   which may serve different content on the second hit (cache, A/B test,
   challenge page).

**Better heuristic:** If GET-primary (R-I Option A) is adopted, this problem
disappears — the response body is already the final-URL body. If HEAD stays
primary, the soft-404 probe MUST GET `response.url` (the final URL), not the
original.

**Verdict: FIX (use `finalUrl` for the probe; obviated by R-I Option A).**

---

### R-K. (NEW) 3xx residual handling — 304, 308, residual 3xx → `unknown`

**Why it exists.** After auto-follow, any remaining 3xx (e.g., 304 Not
Modified) is "unexpected" and classified `unknown unexpected_status`.

**RFC basis.**

- **304 Not Modified** (RFC 9110 §15.4.5): a successful response to a
  conditional GET with `If-None-Match` / `If-Modified-Since`. It means **the
  resource is alive and unchanged** — the opposite of broken.
- **308 Permanent Redirect** (RFC 7538): the resource has moved permanently.
  After auto-follow, this resolves to the target. A residual 308 means
  redirect cap hit.
- **300/305/306**: rare; 305/306 are deprecated.

**Browser behavior.** 304 is transparent to the user (browser uses cached
representation). The user sees a working page.

**Industry comparator.** lychee: 3xx after redirect cap is "error."
Google: follows redirects; 304 is fine.

**Optimal?** **No.** 304 specifically is a _positive_ signal — it means the
server confirmed the resource exists and is unchanged. Classifying it as
`unknown` is a FP (amber warning on a known-good link). The current code
can't send conditional requests (no `If-None-Match`), so a 304 from a
non-conditional request is actually a server spec violation — but it still
indicates the resource exists.

**Better heuristic:**

```
304 (after non-conditional request) → alive, reason='not_modified' (server confirms resource exists)
308 after redirect cap              → unknown, reason='redirect_cap'
Other residual 3xx                  → unknown, reason='unexpected_redirect'
```

**Verdict: FIX (304 → `alive`; P2).**

---

### R-L. (NEW) `Retry-After` handling — 429/503 with `Retry-After`

**Why it exists.** `Retry-After` is parsed (cap 30s) for retry scheduling, but
once retries exhaust, the verdict is terminal (`confirmed_broken` for 429;
`confirmed_broken` for 503).

**RFC basis.** RFC 9110 §10.2.3: `Retry-After` can be a delta-seconds or an
HTTP-date. For 429 (RFC 6585 §4) and 503, it tells the client _when to retry_.

**Browser behavior.** Browsers don't auto-retry 429/503; the user does
manually.

**Industry comparator.** lychee retries 3× with `Retry-After` honored;
terminal failure is "error."

**Optimal?** **Partly.** The 30s cap is correct for in-request retry (you
can't hold a request open for hours). But a 429 with `Retry-After: 3600`
(one hour) carries information that should influence _cross-run_ scheduling:
the next weekly cron is 168 hours away, well past the retry window. If the
`Retry-After` is shorter than the cron interval, the link is almost certainly
fine by next run.

**Better heuristic:**

```
429/503 + Retry-After <= 1 hour  → unknown, reason='rate_limited_temporary'
                                   (high confidence recovery by next run)
429/503 + Retry-After > 1 hour   → unknown, reason='rate_limited_extended'
429/503 + no Retry-After         → unknown, reason='rate_limited'
```

This becomes a `reason` discriminator, not a state change. The verdict stays
`unknown` (per R-D/R-E fixes).

**Verdict: ADD (cross-run Retry-After metadata; P2).**

---

### R-M. (NEW) 2xx with non-HTML content type

**Why it exists (implicit).** The soft-404 probe assumes HTML body. A 2xx
returning `application/pdf`, `image/*`, `video/*`, or `application/json`
isn't checked for soft-404 at all (the keyword/title signals won't match
binary content). The current code doesn't explicitly handle this — it reads
the body as text and runs the regex, which is harmless but wasteful.

**RFC basis.** RFC 9110 §8.3: `Content-Type` defines the representation type.

**Browser behavior.** Browser renders PDFs/images/videos natively or prompts
to download. These are clearly "alive" resources.

**Industry comparator.** lychee: 2xx is OK regardless of content type.

**Optimal?** **Yes, effectively.** A 2xx PDF is alive; no soft-404 check
applies. But the code doesn't _skip_ the probe — it runs regexes on binary
content. Not a bug today (regexes don't match), but wasteful and fragile
(a PDF with the bytes `0x70 0x61 0x67 0x65 0x20 0x6e 0x6f 0x74 0x20 0x66
0x6f 0x75 0x6e 0x64` = "page not found" would match).

**Better heuristic:**

```
2xx + Content-Type ∈ {application/pdf, image/*, video/*, audio/*, application/octet-stream}
     → alive, reason='ok_binary' (skip soft-404 probe entirely)
2xx + Content-Type: text/html (or unset, defaulting to HTML)
     → run soft-404 probe (current behavior)
```

**Verdict: FIX (skip probe for non-HTML; P2).**

---

### R-N. (NEW) 2xx with login-wall / interstitial

**Why it exists (gap).** Not detected. A 200 behind-cookie-auth passes as
`alive`. A 200 login interstitial with `<title>Sign in` is not in the
soft-404 keyword set → `alive`.

**RFC basis.** None — login walls are an application pattern, not an HTTP
concept.

**Browser behavior.** Browser shows the login page; user sees a working link
to a page that demands auth. From the user's perspective, the link is
"alive but locked."

**Industry comparator.** No link checker detects login walls reliably.
Google treats them as "crawlable but blocked" (indexes the URL, not the
content behind it).

**Optimal?** **Gap, but low priority.** A login-walled page is _not broken_
— it's accessible to authenticated users. Marking it `unknown` would be
a FP (amber warning where none is needed). Marking it `alive` is defensible
(the resource exists).

The refinement — capture as metadata, not state:

```
2xx + <title> matches /sign in|log in|login/i + body < 4 KB
     → alive, reason='login_wall_suspected' (not a broken-state change)
```

This gives observability without changing the verdict. Low priority because
the current `alive` is already correct.

**Verdict: KEEP `alive`; ADD optional metadata flag (P3).**

---

### Rule critique summary

| Rule                              | Verdict                                   | Priority | Impact                      |
| --------------------------------- | ----------------------------------------- | -------- | --------------------------- |
| R-A Always-alive synthetic 200    | FIX (http_status=NULL) → REPLACE (oEmbed) | P0 / P2  | Honesty, FN ceiling         |
| R-B 401/403 → unknown             | KEEP + ADD signal discrimination          | P1       | FP debugging                |
| R-C 410/451 → confirmed_broken    | KEEP (451 add metadata)                   | P3       | Minor                       |
| R-D 5xx → confirmed_broken        | FIX (→ unknown)                           | **P0**   | **Highest FP reduction**    |
| R-E 4xx blanket                   | FIX (split class; retry 406/415)          | P1       | FP reduction                |
| R-F Soft-404 4KB gate             | FIX (decouple tiers)                      | **P0**   | FN reduction                |
| R-G Soft-404 singletons           | REMOVE                                    | P1       | FP reduction                |
| R-H Network errors, no escalation | KEEP + ADD per-reason ladder              | P1       | FN ceiling for dead domains |
| R-I HEAD → GET fallback           | REPLACE (GET-primary)                     | P1       | Simplification, correctness |
| R-J finalUrl discarded            | FIX (use finalUrl; obviated by R-I)       | P2       | Correctness                 |
| R-K 304 → unknown                 | FIX (304 → alive)                         | P2       | FP reduction                |
| R-L Retry-After cross-run         | ADD metadata                              | P2       | Observability               |
| R-M 2xx non-HTML                  | FIX (skip probe)                          | P2       | Performance, correctness    |
| R-N Login-wall                    | KEEP alive; ADD optional flag             | P3       | Observability               |

---

## 3. Real-World Scenario Matrix

50 cases spanning every classification path, with the **expected** verdict
(what a human checking the link in a browser would conclude), the **current**
verdict (what the code does today), and the **target** verdict (after the
roadmap in §6). Discrepancies are marked in **bold**.

### 3.1 Success path (2xx)

| #   | Scenario                                                               | Expected        | Current                   | Target                | Gap    |
| --- | ---------------------------------------------------------------------- | --------------- | ------------------------- | --------------------- | ------ |
| 1   | Standard blog post, HEAD 200, 50 KB body                               | alive           | alive                     | alive                 | —      |
| 2   | HEAD 200, GET 200 with OG image and canonical self-ref                 | alive           | alive                     | alive                 | —      |
| 3   | 200 PDF (`Content-Type: application/pdf`, 2 MB)                        | alive           | alive (probe wasted)      | alive (probe skipped) | perf   |
| 4   | 200 image (`Content-Type: image/png`)                                  | alive           | alive (probe wasted)      | alive (probe skipped) | perf   |
| 5   | 200 JSON API endpoint (500 bytes, `{"status":"ok"}`)                   | alive           | alive                     | alive                 | —      |
| 6   | 200 with `<title>404</title>`, 300 bytes, real soft-404                | likely_broken   | likely_broken             | likely_broken         | —      |
| 7   | 200 with `<title>404</title>`, 8 KB (rich soft-404 with nav/footer)    | likely_broken   | **alive** (gate kills it) | likely_broken         | **FN** |
| 8   | 200 with `<link rel=canonical href="/404">`, 15 KB                     | likely_broken   | **alive** (gate)          | likely_broken         | **FN** |
| 9   | 200 with `class="error-page"`, 6 KB                                    | likely_broken   | **alive** (gate)          | likely_broken         | **FN** |
| 10  | 200 blog post titled "Why 404 Pages Matter" discussing not-found, 8 KB | alive           | alive                     | alive                 | —      |
| 11  | 200 login wall, `<title>Sign in</title>`, 3 KB                         | alive           | alive                     | alive (flag)          | —      |
| 12  | 200 Cloudflare "Just a moment..." interstitial, 4 KB                   | alive           | alive                     | alive (flag)          | —      |
| 13  | 200 empty body (0 bytes)                                               | unknown/suspect | alive                     | likely_broken         | **FN** |
| 14  | 200 with `Retry-After` header (nonsensical on 2xx, ignore)             | alive           | alive                     | alive                 | —      |
| 15  | 200 with meta refresh to `/login` after 2s                             | alive (locked)  | alive                     | alive (flag)          | —      |

### 3.2 Redirects (3xx)

| #   | Scenario                                                     | Expected         | Current                     | Target                           | Gap    |
| --- | ------------------------------------------------------------ | ---------------- | --------------------------- | -------------------------------- | ------ |
| 16  | 301 → 200 final, redirect chain length 2                     | alive            | alive                       | alive                            | —      |
| 17  | 301 → 404 final (redirect to a gone page)                    | confirmed_broken | confirmed_broken            | confirmed_broken                 | —      |
| 18  | 301 → parked domain soft-404, original was real              | likely_broken    | **alive** (probes original) | likely_broken (probes final)     | **FN** |
| 19  | 308 permanent redirect, redirect cap hit (10+ hops)          | unknown          | unknown                     | unknown                          | —      |
| 20  | 304 Not Modified (server returns 304 to non-conditional GET) | alive            | **unknown**                 | alive                            | **FP** |
| 21  | 302 → 200 (temporary redirect, common)                       | alive            | alive                       | alive                            | —      |
| 22  | Redirect loop (a→b→a)                                        | unknown          | unknown (via network_error) | unknown (explicit redirect_loop) | reason |

### 3.3 Client errors (4xx)

| #   | Scenario                                                                 | Expected         | Current                | Target                           | Gap    |
| --- | ------------------------------------------------------------------------ | ---------------- | ---------------------- | -------------------------------- | ------ |
| 23  | 404 Not Found (standard)                                                 | confirmed_broken | confirmed_broken       | confirmed_broken                 | —      |
| 24  | 410 Gone (explicit permanent removal)                                    | confirmed_broken | confirmed_broken       | confirmed_broken                 | —      |
| 25  | 451 Legal block                                                          | confirmed_broken | confirmed_broken       | confirmed_broken (legal_block)   | —      |
| 26  | 401 with `WWW-Authenticate: Basic`                                       | unknown          | unknown                | unknown (auth_required)          | —      |
| 27  | 401 without `WWW-Authenticate` (bot detection)                           | unknown          | unknown                | unknown (bot_challenge)          | —      |
| 28  | 403 Cloudflare challenge (`cf-mitigated: challenge`)                     | unknown          | unknown                | unknown (cloudflare)             | —      |
| 29  | 403 plain (server refuses)                                               | unknown          | unknown (GET fallback) | unknown (GET fallback)           | —      |
| 30  | 405 HEAD → GET 200 (server rejects HEAD)                                 | alive            | alive                  | alive                            | —      |
| 31  | 429 after retry, with `Retry-After: 60`                                  | unknown          | **confirmed_broken**   | unknown (rate_limited)           | **FP** |
| 32  | 429 after retry, no `Retry-After`                                        | unknown          | **confirmed_broken**   | unknown (rate_limited)           | **FP** |
| 33  | 408 Request Timeout                                                      | unknown          | **confirmed_broken**   | unknown (transient)              | **FP** |
| 34  | 425 Too Early (0-RTT TLS)                                                | unknown          | **confirmed_broken**   | unknown (transient)              | **FP** |
| 35  | 406 Not Acceptable (server only serves PDF, we sent `Accept: text/html`) | alive (retry)    | **confirmed_broken**   | alive (retry with `Accept: */*`) | **FP** |
| 36  | 400 Bad Request (malformed URL)                                          | confirmed_broken | confirmed_broken       | confirmed_broken                 | —      |

### 3.4 Server errors (5xx)

| #   | Scenario                                             | Expected         | Current              | Target                           | Gap    |
| --- | ---------------------------------------------------- | ---------------- | -------------------- | -------------------------------- | ------ |
| 37  | 500 after retry (persistent server error)            | unknown          | **confirmed_broken** | unknown (server_error)           | **FP** |
| 38  | 502 Bad Gateway after retry                          | unknown          | **confirmed_broken** | unknown (server_error)           | **FP** |
| 39  | 503 with `Retry-After: 300` (maintenance window)     | unknown          | **confirmed_broken** | unknown (rate_limited_temporary) | **FP** |
| 40  | 504 Gateway Timeout, NOT retried                     | unknown          | **confirmed_broken** | unknown (server_error, retried)  | **FP** |
| 41  | 511 Captive portal (hotel WiFi intercept)            | unknown          | **confirmed_broken** | unknown (captive_portal)         | **FP** |
| 42  | 500 persistent for 4 weeks (server genuinely broken) | confirmed_broken | confirmed_broken     | confirmed_broken (escalation)    | —      |

### 3.5 Network errors

| #   | Scenario                         | Expected                             | Current           | Target                                     | Gap    |
| --- | -------------------------------- | ------------------------------------ | ----------------- | ------------------------------------------ | ------ |
| 43  | DNS NXDOMAIN (domain expired)    | unknown → confirmed_broken (4 weeks) | unknown (forever) | unknown → confirmed_broken                 | **FN** |
| 44  | TLS cert expired                 | unknown                              | unknown           | unknown → confirmed_broken (8 weeks)       | **FN** |
| 45  | Connection refused (server down) | unknown                              | unknown           | unknown → confirmed_broken (8 weeks)       | **FN** |
| 46  | Timeout (slow server, 10s)       | unknown                              | unknown           | unknown                                    | —      |
| 47  | DNS NXDOMAIN persistent 8 weeks  | confirmed_broken                     | unknown (forever) | confirmed_broken (dns_nxdomain_persistent) | **FN** |
| 48  | Network reset (intermittent)     | unknown                              | unknown (retried) | unknown (retried)                          | —      |

### 3.6 Always-alive domains

| #   | Scenario                                                     | Expected                 | Current                          | Target                        | Gap     |
| --- | ------------------------------------------------------------ | ------------------------ | -------------------------------- | ----------------------------- | ------- |
| 49  | Live YouTube video                                           | alive                    | alive (synthetic 200)            | alive (oEmbed verified)       | honesty |
| 50  | Deleted YouTube video                                        | unknown/confirmed_broken | **alive** (synthetic 200)        | confirmed_broken (oEmbed 404) | **FN**  |
| 51  | Live tweet                                                   | alive                    | alive (synthetic 200)            | alive (oEmbed)                | honesty |
| 52  | Deleted tweet                                                | unknown/confirmed_broken | **alive** (synthetic 200)        | confirmed_broken (oEmbed)     | **FN**  |
| 53  | `evil.com/twitter.com` (path contains always-alive hostname) | checked normally         | alive (correct — hostname match) | alive                         | —       |

### 3.7 Edge cases

| #   | Scenario                                       | Expected                        | Current                    | Target              | Gap  |
| --- | ---------------------------------------------- | ------------------------------- | -------------------------- | ------------------- | ---- |
| 54  | `.onion` URL (non-routable)                    | unknown                         | unknown (DNS fail)         | unknown (prefilter) | perf |
| 55  | `localhost` / `127.0.0.1` bookmark             | unknown/error                   | unknown (DNS/conn refused) | unknown (prefilter) | perf |
| 56  | `data:` URI                                    | N/A (not a link)                | — (not handled)            | skip                | gap  |
| 57  | `mailto:` URI                                  | N/A (not a link)                | — (not handled)            | skip                | gap  |
| 58  | URL with fragment (`#section`)                 | alive (fragment is client-side) | alive                      | alive               | —    |
| 59  | URL with tracking params that 404 without them | alive                           | depends on server          | alive               | —    |
| 60  | HTTP→HTTPS redirect (80→443)                   | alive                           | alive                      | alive               | —    |

### Summary of gaps identified

| Gap type                                                | Count                                                 | Priority |
| ------------------------------------------------------- | ----------------------------------------------------- | -------- |
| **FP (false positive — marks alive/unknown as broken)** | 11 (cases 20, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41) | P0–P1    |
| **FN (false negative — marks broken as alive/unknown)** | 9 (cases 7, 8, 9, 13, 18, 43, 44, 45, 47, 50, 52)     | P0–P1    |
| **Honesty/perf gaps**                                   | 5 (cases 3, 4, 49, 51, 54, 55)                        | P1–P2    |
| **No gap**                                              | 25                                                    | —        |

The 11 FP cases all stem from two root causes: (a) 5xx/429/408/425/511
classified as `confirmed_broken` (R-D, R-E), and (b) 304 as `unknown` (R-K).
Fixing R-D, R-E, and R-K eliminates all 11 FPs in one sweep.

The 9 FN cases stem from: (a) the soft-404 body-size gate killing
high-precision signals on large pages (R-F: cases 7, 8, 9, 13), and (b) no
escalation for persistent network failures (R-H: cases 43, 44, 45, 47) or
always-alive domains (R-A: cases 50, 52).

---

## 4. False-Positive / False-Negative Threat Model

A threat model treats each error class as an attacker with a specific
capability. For a link checker, the "attacker" is the network/server
environment; the "asset" is the user's trust in the `broken_status` field.

### 4.1 Threat inventory

| Threat                     | Class           | Capability                                                | Current exposure                           | Target exposure                   |
| -------------------------- | --------------- | --------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| **Deploy blip**            | FP              | Server returns 500 for 5 min during deploy                | Red for up to 7 days                       | Amber for 1 run                   |
| **Rate limiter**           | FP              | GitHub/API returns 429 with `Retry-After: 60`             | Red until next cron                        | Amber, auto-recovers              |
| **Maintenance window**     | FP              | 503 with `Retry-After: 3600` on Sunday                    | Red for 7 days                             | Amber, recovers next run          |
| **Captive portal**         | FP              | Hotel WiFi intercepts all HTTP → 511                      | Red forever (until next non-captive check) | Amber, reason='captive_portal'    |
| **Cloudflare challenge**   | FP              | 403 + JS challenge page                                   | unknown (correct)                          | unknown (correct) + reason        |
| **Content negotiation**    | FP              | Server serves only PDF, we sent `Accept: text/html` → 406 | Red forever                                | Retry with `Accept: */*` → alive  |
| **Method rejection**       | FP              | HEAD returns 400, GET works                               | Red forever                                | GET fallback → alive              |
| **Large soft-404**         | FN              | CMS 404 page with full nav/footer > 4 KB                  | Alive forever                              | likely_broken via Tier-1 signals  |
| **Parked domain redirect** | FN              | Old URL 301→parked page with soft-404                     | Alive (probes original)                    | likely_broken (probes final)      |
| **Deleted social media**   | FN              | Deleted tweet/youtube                                     | Alive forever (synthetic)                  | confirmed_broken via oEmbed       |
| **Expired domain**         | FN              | DNS NXDOMAIN for 8 weeks                                  | unknown forever                            | confirmed_broken after 4 weeks    |
| **Dead small site**        | FN              | Connection refused for 8 weeks                            | unknown forever                            | confirmed_broken after 8 weeks    |
| **Cookie-auth wall**       | FP/FN           | 200 with `<title>Sign in</title>`                         | alive (defensible)                         | alive + flag (observability)      |
| **Server-side A/B test**   | Non-determinism | Server returns 200 on run 1, 404 on run 2                 | Flips state each run                       | Flips state each run (accepted)   |
| **IPv6-only server**       | FP              | Server only has AAAA record, runtime lacks IPv6           | unknown (DNS/connection fail)              | unknown (prefilter or dual-stack) |

### 4.2 Threat prioritization

**Tier 1 — High-frequency, high-user-impact (P0):**

1. **Deploy blip → red for a week.** The most common FP. Any user who
   bookmarks dev-docs sites (Stripe, Twilio, AWS) sees red after their
   weekly cron catches a 5-minute 500. The 7-day cadence amplifies a 5-min
   event into a 7-day warning. Fix: R-D (5xx → unknown).

2. **Rate limiter → red for a week.** GitHub, Twitter, Reddit all rate-limit
   unauthenticated API calls. A bookmark to a GitHub issue can return 429
   during a busy period. Fix: R-E (429 → unknown).

3. **Large soft-404 → alive forever.** Modern CMS 404 pages are 8–20 KB.
   The 4 KB gate disables the highest-precision signals. Fix: R-F (decouple
   tiers).

**Tier 2 — Medium-frequency, medium-impact (P1):**

4. **Expired domain → unknown forever.** Domains lapse; users don't always
   notice. The escalation ladder (R-H) bounds this FN to 4 weeks.

5. **Deleted social media → alive forever.** Always-alive synthetic 200 is
   the most dishonest signal in the system. Fix: R-A (oEmbed verification).

6. **Content negotiation 406 → red.** Rare but completely avoidable. Fix:
   R-E (retry with `Accept: */*`).

**Tier 3 — Low-frequency, low-impact (P2+):**

7. Captive portal, method rejection, cookie-auth wall, IPv6-only server.
   All result in `unknown`, which is the epistemically honest answer.
   Refinements add `reason` discrimination, not state changes.

### 4.3 Non-threats (explicitly out of scope)

- **JavaScript-rendered SPAs.** A 200 returning `<div id="root"></div>` with
  client-side rendering is alive — the resource exists, the browser renders
  it. Server-side rendering is not a requirement for "alive." Detecting
  "JS-only empty page" as broken would be a massive FP source (every React
  app would be flagged).

- **Paywalled content.** A 200 with a paywall interstitial is alive — the
  resource exists, access requires payment. Not broken.

- **Geo-blocked content.** A 453 (non-standard) or 403 with geo-detection
  is regionally broken, not globally. Current `unknown` is defensible.

- **Content drift.** A URL that once served article A and now serves article
  B (without redirect) is content drift, not link breakage. Out of scope.

### 4.4 Confidence model

Each verdict carries an implicit confidence level. Making it explicit:

| Verdict                                   | Confidence      | Rationale                                             |
| ----------------------------------------- | --------------- | ----------------------------------------------------- |
| `confirmed_broken` via 410                | **Very high**   | Server explicitly says "gone permanently"             |
| `confirmed_broken` via 404                | **High**        | Server explicitly says "not found"                    |
| `confirmed_broken` via escalation         | **High**        | N weeks of consistent failure (RFC 8020 for NXDOMAIN) |
| `confirmed_broken` via 451                | **Medium-high** | Resource may exist in other jurisdictions             |
| `likely_broken` via Tier-1 soft-404       | **High**        | canonical/error-class are near-definitive             |
| `likely_broken` via Tier-2 soft-404       | **Medium**      | title + keyword combo, some FP risk                   |
| `alive` via 2xx + no soft-404             | **High**        | Server confirmed resource                             |
| `alive` via always-alive (current)        | **Zero**        | No request made (synthetic)                           |
| `alive` via always-alive (target: oEmbed) | **High**        | Platform API confirmed                                |
| `unknown` via timeout                     | **N/A**         | Epistemically honest "don't know"                     |
| `unknown` via bot challenge               | **N/A**         | Server is up, we can't verify                         |

This model makes the user-facing severity mapping defensible: red = "we're
sure it's gone," amber = "we can't verify or it's probably gone," hidden =
"we're sure it's fine."

---

## 5. Extensibility Review

How well does the current design accommodate future features? For each
planned feature, the review identifies friction points and required changes.

### 5.1 Feature: Persisted `reason` field

**Status:** Not persisted (audit §6 #9).

**Required to unlock:** FP debugging, confidence scoring, per-reason
escalation (R-H), per-reason observability (audit §6 #15).

**Friction:** The DB schema lacks the column. The persist call in
`scripts/check-urls.ts:148-157` doesn't write it. The UI doesn't display it.

**Extensibility score: BLOCKING.** Persisting `reason` is the single
highest-leverage change — it unblocks R-H escalation, confidence scoring,
and FP debugging. Without it, the system is a black box.

**Migration:** Add `bookmarks.health_reason TEXT NULL` and a
`bookmarks.consecutive_unknown_count INT DEFAULT 0` column. Update
`persistResult` to write both. The classifier already produces a `reason`
string — no classifier changes needed.

### 5.2 Feature: Cross-run backoff (Retry-After honored across runs)

**Status:** Not implemented.

**Required to unlock:** R-L (rate-limited hosts recover without
re-pinging), reduced load on rate-limited APIs.

**Friction:** The cron has no memory of previous `Retry-After` values.
`last_checked_at` is the only timestamp. To honor a `Retry-After: 86400`
(1 day), the system would need to skip the URL for 1 day — but the cron is
weekly, so this is mostly moot (1 day < 7 days).

**Extensibility score: LOW friction.** The weekly cadence already exceeds
any reasonable `Retry-After`. If the cron moves to daily (P3 scalability),
this becomes relevant.

### 5.3 Feature: User-configurable accept list

**Status:** Not implemented (hardcoded).

**Required to unlock:** Power users who want to treat 401 as broken (e.g.,
for internal bookmarks behind auth they hold).

**Friction:** The classifier is a pure function of status code + body; it
doesn't read user preferences. Adding per-user config would require passing
a profile into `checkUrl`, which currently takes only `url`.

**Extensibility score: MEDIUM friction.** The signature change is small
(`checkUrl(url, opts?)`), but the DB query in `check-urls.ts` would need
to join profiles, and the per-host throttle would need to respect per-user
overrides. Not recommended for v1 — the 4-state model covers 95% of users.

### 5.4 Feature: On-demand recheck (user clicks "recheck now")

**Status:** Not implemented (cron-only).

**Required to unlock:** User-driven recovery from FP, fresh metadata
fetching.

**Friction:** `checkUrl` is already a pure function callable from anywhere.
The friction is the per-host throttle (`runWithPerHostConcurrency`) and
the `MAX_BOOKMARKS_PER_RUN=500` cap — both are cron-specific.

**Extensibility score: LOW friction.** Extract `checkUrl` into a
serverless function, expose an authenticated endpoint, call from the UI.
The classifier needs no changes.

### 5.5 Feature: Bulk recheck on workspace setting toggle

**Status:** Not implemented.

**Required to unlock:** User enables `auto_check_broken` on an existing
workspace with 500 bookmarks; expects all to be checked within minutes.

**Friction:** Same as 5.4. The cron query selects bookmarks where
`last_checked_at IS NULL OR last_checked_at < NOW() - 7 days` — a
freshly-toggled workspace's bookmarks have `last_checked_at = NULL`
(from optimistic add) and would be picked up on the next cron, but not
immediately.

**Extensibility score: LOW friction.** Same as 5.4 + a UI-triggered
queue. Classifier unchanged.

### 5.6 Feature: Confidence score (0–100) per bookmark

**Status:** Not implemented.

**Required to unlock:** User-facing "how sure are we?" indicator, sorting
by confidence.

**Friction:** Requires `reason` (5.1) and the confidence model (§4.4).
The classifier produces enough signal to derive a score today (status +
soft-404 tier + retries), but it's not exposed.

**Extensibility score: MEDIUM friction.** Add a `confidence SMALLINT`
column, derive from `reason` + `http_status` + `consecutive_unknown_count`.
Classifier changes minimal; UI changes significant.

### 5.7 Feature: Soft-404 template learning

**Status:** Not implemented.

**Required to unlock:** Site-specific soft-404 detection (e.g., learn that
`example.com/error` is the 404 template, then flag any redirect to it).

**Friction:** Requires storing per-host 404 templates. The current
soft-404 detection is stateless per-URL. Adding host-level state is a
schema change (`host_404_templates` table) and a fetch-time lookup.

**Extensibility score: HIGH friction.** Not recommended for v1. The
Tier-1 signals (canonical, error-class) cover most cases. Template
learning is a v2+ feature.

### 5.8 Feature: Web Archive fallback (Wayback Machine)

**Status:** Not implemented.

**Required to unlock:** "This link is broken, but here's an archived copy"
UX. lychee has `--suggest` with `--archive wayback`.

**Friction:** Requires a Wayback API call on `confirmed_broken` verdicts.
Adds latency and external dependency.

**Extensibility score: LOW friction.** Post-classification step, no
classifier changes. Add a `archived_url TEXT NULL` column and a
post-persist hook.

### 5.9 Feature: Plugin/custom rules

**Status:** Not supported.

**Required to unlock:** Enterprise users with custom 404 detection (e.g.,
internal CMS patterns).

**Friction:** The classifier is a hardcoded function. Adding plugin support
would require a rule engine, config schema, and security model.

**Extensibility score: VERY HIGH friction.** Out of scope for v1. The
4-state model with Tier-1/2/3 soft-404 signals covers the 80% case.

### 5.10 Extensibility summary

| Feature                    | Friction  | Priority     |
| -------------------------- | --------- | ------------ |
| Persisted `reason`         | BLOCKING  | P0           |
| Cross-run backoff          | Low       | P3           |
| User accept list           | Medium    | P3           |
| On-demand recheck          | Low       | P2           |
| Bulk workspace recheck     | Low       | P2           |
| Confidence score           | Medium    | P2           |
| Soft-404 template learning | High      | P3+          |
| Web Archive fallback       | Low       | P3           |
| Plugin/custom rules        | Very high | Out of scope |

The design's purity (stateless classifier, 4-state enum, weekly overwrite)
is its core extensibility asset. Every future feature either slots in as
metadata (`reason`, `confidence`, `archived_url`) or as a pre/post-hook
(on-demand recheck, Wayback fallback). No feature requires changing the
4-state model — which is the strongest validation of the current design's
foundation.

---

## 6. Prioritized Roadmap

Ordered by impact-to-effort ratio. Each item specifies the rule it addresses
(§2), the expected FP/FN delta, the schema/classifier changes, and a
measurable success criterion.

### P0 — Spec-correctness & highest-impact FP elimination

#### 6.1 5xx → `unknown` (R-D)

**Change:** In `classifyByHttpStatus`, route all 5xx (except 507/508/510
which remain `confirmed_broken`) to `unknown` with `reason='server_error'`
after retry exhaustion. Add 504 to retry statuses (`http-fetch.ts:21`).

**Schema:** None (uses existing `broken_status`).

**FP eliminated:** Deploy blips, maintenance windows, gateway timeouts,
captive portals (cases 37–41). Estimated 30–50% of all `confirmed_broken`
FPs in production.

**Success criterion:** A bookmark that returns 500 for one cron run shows
amber, not red. After 4 consecutive weekly `unknown server_error` verdicts,
the escalation ladder (6.7) may promote to `confirmed_broken`.

#### 6.2 429 / 408 / 425 → `unknown` (R-E)

**Change:** In `classifyByHttpStatus`, route 429 (after retry), 408, 425 to
`unknown` with `reason='rate_limited'` / `reason='transient'`.

**Schema:** None.

**FP eliminated:** Rate-limited hosts, client timeouts, 0-RTT TLS replay
rejection (cases 31–34). Estimated 10–15% of `confirmed_broken` FPs.

**Success criterion:** A GitHub-issue bookmark that hits a 429 shows amber,
not red.

#### 6.3 504 added to retry statuses (R-D)

**Change:** Add `504` to `DEFAULT_RETRY_STATUSES` in `http-fetch.ts:21`.

**Schema:** None.

**FP eliminated:** Single 504 gateway timeouts (case 40).

**Success criterion:** A 504 is retried before classification; only
persistent 504 (3 failures) reaches the verdict.

#### 6.4 Soft-404 precision tiers (R-F, R-G)

**Change:** Restructure `detectSoft404` into 4 tiers (§2 R-F). Remove
singleton `soft404_body_keyword` and `soft404_title` branches. Add Tier-4
negative signals (canonical self-reference, og:title, body > 64 KB).

**Schema:** None (the `reason` field values change, but no column needed
until 6.6).

**FN eliminated:** Large soft-404 pages with high-precision signals
(cases 7, 8, 9). Estimated 40–60% of soft-404 FNs.

**FP eliminated:** Short pages with "not found" in non-404 context
(R-G singletons). Estimated 5–10% of `likely_broken` FPs.

**Success criterion:** A 12 KB CMS 404 page with
`<link rel=canonical href="/404">` is classified `likely_broken`.

#### 6.5 Stop persisting synthetic `http_status=200` for always-alive (R-A)

**Change:** In the always-alive short-circuit path, persist
`http_status=NULL` with `reason='always_alive'`. The verdict stays `alive`.

**Schema:** None (`http_status` is already nullable).

**Honesty fixed:** The `http_status` field now always reflects a real HTTP
response (cases 49, 51). Downstream consumers no longer see a fabricated 200.

**Success criterion:** `SELECT http_status FROM bookmarks WHERE
broken_status='alive' AND reason='always_alive'` returns NULL.

**Note:** This change is P0 because it's a one-line fix with zero behavioral
risk — the UI already handles `http_status=NULL` (optimistic add sets it
NULL). It just makes the always-alive path honest.

### P1 — FP reduction, FN ceiling, simplification

#### 6.6 Persist `reason` and `consecutive_unknown_count` (audit §6 #9, R-H)

**Change:** Add `bookmarks.health_reason TEXT NULL` and
`bookmarks.consecutive_unknown_count SMALLINT DEFAULT 0`. Update
`persistResult` to write both. Compute `consecutive_unknown_count` as
`CASE WHEN new_status='unknown' THEN old_count+1 ELSE 0 END`.

**Schema:** Migration adds two columns. Backfill `reason=NULL`,
`consecutive_unknown_count=0` for existing rows.

**Unblocks:** R-H escalation (6.7), confidence scoring (6.12), per-reason
observability (6.14).

**Success criterion:** `SELECT health_reason, COUNT(*) FROM bookmarks GROUP
BY 1` returns a distribution. A bookmark that was `unknown` for 3 weeks has
`consecutive_unknown_count=3`.

#### 6.7 Per-reason escalation ladder (R-H)

**Change:** After persisting, if `consecutive_unknown_count` crosses the
threshold for the `reason`:

- `dns_nxdomain` (N≥4): promote to `confirmed_broken`,
  `reason='dns_nxdomain_persistent'`
- `tls_failure` (N≥8): promote to `confirmed_broken`,
  `reason='tls_persistent'`
- `connection_refused`/`reset` (N≥8): promote to `confirmed_broken`,
  `reason='unreachable_persistent'`
- `timeout` (N≥8): stay `unknown`, surface count in UI
- `bot_challenge*` / `rate_limited*`: never escalate

**Requires:** 6.6 (reason + count persisted).

**FN eliminated:** Dead domains, expired certs, dead servers (cases 43–47).
Estimated 20–30% of `unknown` FNs that are actually broken.

**Success criterion:** A domain returning NXDOMAIN for 4 weeks shows red.

#### 6.8 401/403 signal discrimination (R-B)

**Change:** In the 401/403 handler, inspect `WWW-Authenticate`,
`Server`, `cf-mitigated` headers and body for "Just a moment" / "Checking
your browser." Set `reason` accordingly.

**FP reduced:** Better debugging of bot-challenge FPs. No state change
(stays `unknown`).

**Success criterion:** A Cloudflare-challenged bookmark shows
`reason='bot_challenge_cloudflare'`, not generic `client_error`.

#### 6.9 Split 4xx class + retry 406/415 (R-E)

**Change:** In `classifyByHttpStatus`, split the 4xx class per §2 R-E.
For 406/415, retry once with `Accept: */*` before classifying.

**FP eliminated:** Content-type negotiation failures (case 35). Estimated
2–5% of `confirmed_broken` FPs.

**Success criterion:** A bookmark to a PDF-only URL returns `alive`.

#### 6.10 Switch to GET-primary (R-I, R-J)

**Change:** Change `checkUrl` to use GET instead of HEAD. Remove
`tryGetFallback` (HEAD→GET fallback). The soft-404 probe becomes a no-op
(GET body already fetched). Use `response.url` (final URL) for soft-404
detection.

**Effort:** Medium. The classifier simplifies substantially — ~80 lines of
HEAD/fallback code removed. Per-host bandwidth increases (~50 KB/check
average vs. ~0.5 KB HEAD).

**FP/FN:** Eliminates R-I (HEAD 401 not retried with GET), R-J (finalUrl
discarded). Simplifies the state machine.

**Success criterion:** `grep -n "tryGetFallback" lib/link-health/checker.ts`
returns no matches. Soft-404 detection runs on the GET body directly.

**Tradeoff note:** This is the largest single change. If deferred, the
incremental fix (extend HEAD→GET fallback to 401/406/415) captures 80% of
the benefit at 20% of the effort. Recommend GET-primary if the team is
willing to do one large refactor; otherwise extend fallback.

#### 6.11 Remove soft-404 singleton branches (R-G)

**Change:** Delete `soft404_body_keyword` and `soft404_title` branches.
Keep `soft404_combined`, `soft404_canonical`, `soft404_error_class`,
`soft404_json_error`.

**FP eliminated:** Short pages with "not found" in non-404 context.

**Success criterion:** No bookmark has `reason` in
`{soft404_body_keyword, soft404_title}` after a full recheck.

---

### P2 — Correctness refinements, observability

#### 6.12 304 → `alive` (R-K)

**Change:** In the residual-status handler, route 304 to `alive` with
`reason='not_modified'`.

**FP eliminated:** 304 on non-conditional GET (case 20).

#### 6.13 Skip soft-404 probe for non-HTML (R-M)

**Change:** Check `Content-Type` on 2xx. If `application/pdf`, `image/*`,
`video/*`, `audio/*`, `application/octet-stream`, skip probe, return
`alive` with `reason='ok_binary'`.

**FP eliminated:** Rare binary-content false matches.
**Perf:** Saves a regex pass on ~10% of bookmarks.

#### 6.14 Per-reason observability in run summary (audit §6 #15)

**Change:** In `check-urls.ts` run summary, emit per-`reason` counts.
Split `unknown` into `timeout`/`network_error`/`rate_limited`/`auth`/
`bot_challenge`/`server_error`/`captive_portal`.

**Success criterion:** The run log shows
`unknown: 12 (timeout=4, network_error=3, rate_limited=2, server_error=2, auth=1)`.

#### 6.15 451 legal-block metadata (R-C)

**Change:** On 451, parse `Link: rel="blocked-by"` header. Persist as
`health_reason='legal_block'` (or a new `blocked_by` column if the team
wants structured data).

**FN/FP:** None. Observability only.

#### 6.16 oEmbed verification for always-alive domains (R-A)

**Change:** For YouTube/Twitter/Instagram bookmarks, call the platform's
oEmbed endpoint instead of short-circuiting. A 200 from oEmbed → `alive`.
A 404 → `confirmed_broken` with `reason='gone_platform'`.

**FN eliminated:** Deleted tweets, deleted YouTube videos (cases 50, 52).

**Success criterion:** A bookmark to a deleted YouTube video shows red
after the next cron.

#### 6.17 Prefilter non-routable hosts (audit §6 #5)

**Change:** Before fetching, check hostname against
`{.onion, localhost, 127.0.0.1, 10.*, 192.168.*, 172.16-31.*, 169.254.*}`.
If matched, return `unknown` with `reason='non_routable'` without burning
retries/timeout.

**Perf:** Saves ~30s of timeout on `.onion` bookmarks (cases 54, 55).

### P3 — Polish, scalability, future features

#### 6.18 Retry-After cross-run metadata (R-L)

**Change:** On 429/503 with `Retry-After`, persist the value. If the next
cron runs within the `Retry-After` window, skip the check (set
`reason='rate_limited_deferred'`).

**Low priority** because the weekly cron interval (168h) exceeds any
realistic `Retry-After`. Becomes relevant if cron moves to daily.

#### 6.19 Confidence score (§4.4, §5.6)

**Change:** Add `bookmarks.health_confidence SMALLINT` derived from
`reason` + `http_status` + `consecutive_unknown_count`. UI shows as a
tooltip or sort key.

**Success criterion:** A 410 bookmark has `confidence=98`; a 500-after-retry
bookmark has `confidence=20`.

#### 6.20 Login-wall metadata flag (R-N)

**Change:** On 2xx with `<title>` matching `/sign in|log in/i` + body < 4 KB,
set `reason='login_wall_suspected'`. Verdict stays `alive`.

**Low priority** — current `alive` is correct; this is observability only.

#### 6.21 Scalability: log eligible-but-capped count (audit §6 #16)

**Change:** In `check-urls.ts`, log how many bookmarks were eligible but
skipped due to `MAX_BOOKMARKS_PER_RUN=500`.

**Success criterion:** Run log shows `eligible: 850, checked: 500, capped: 350`.

#### 6.22 On-demand recheck endpoint (§5.4)

**Change:** Extract `checkUrl` into an authenticated API endpoint. UI "Recheck
now" button calls it for a single bookmark.

**Success criterion:** User clicks "Recheck" on a bookmark; status updates
within 10s.

#### 6.23 Web Archive fallback (§5.8)

**Change:** On `confirmed_broken`, call Wayback Machine API. If archived copy
exists, persist `archived_url`.

**Success criterion:** Broken bookmarks show "View archived version" link.

### Roadmap summary

| Priority | Items               | FP eliminated             | FN eliminated          | Effort     |
| -------- | ------------------- | ------------------------- | ---------------------- | ---------- |
| **P0**   | 6.1–6.5 (5 items)   | ~50–60% of current FPs    | ~30–40% of current FNs | Low–Medium |
| **P1**   | 6.6–6.11 (6 items)  | ~15–20% more FPs          | ~20–30% more FNs       | Medium     |
| **P2**   | 6.12–6.17 (6 items) | ~5% FPs                   | ~5% FNs                | Low        |
| **P3**   | 6.18–6.23 (6 items) | Observability/scalability | —                      | Low–Medium |

**After P0+P1, the expected FP rate drops from ~15–20% (estimated, based on
the threat model) to <5%, and the FN ceiling is bounded by the escalation
ladder (dead domains escalate in 4 weeks, dead servers in 8 weeks).** The
state machine remains 4-state and deterministic — all improvements are
metadata (`reason`, `consecutive_unknown_count`, `confidence`) or
classifier-internal (tiered soft-404, split 4xx), not new states.

---

## 7. Target State Machine (production-grade)

The 4-state model is preserved. The improvements are in (a) which inputs
map to which state, (b) the `reason` metadata, and (c) the escalation
ladder for persistent `unknown`. This is the **minimal deterministic**
production-grade machine.

### 7.1 States (unchanged)

| State              | Meaning                                                                                         | `is_broken` | UI     |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------- | ------ |
| `alive`            | 2xx (not soft-404), or 304, or always-alive (oEmbed-verified)                                   | false       | hidden |
| `confirmed_broken` | 410, 404, 451; or persistent-unknown escalation                                                 | true        | red    |
| `likely_broken`    | 2xx + soft-404 (Tier-1/2 signal)                                                                | true        | amber  |
| `unknown`          | 5xx after retry, 401/403 (post-GET), 408/425/429, network errors, bot challenge, captive portal | false       | amber  |

### 7.2 Classification rules (target)

Ordered by precedence (first match wins):

```
ALIVE            ← host ∈ always-alive AND oEmbed verifies (or synthetic with http_status=NULL)
ALIVE            ← 2xx + Content-Type ∉ {HTML} → reason='ok_binary'
ALIVE            ← 2xx + not soft-404 (Tier-1/2/3/4) → reason='ok'
ALIVE            ← 304 → reason='not_modified'

LIKELY_BROKEN    ← 2xx + soft-404 Tier-1 (canonical/error-class/JSON)
LIKELY_BROKEN    ← 2xx + soft-404 Tier-2 (title+keyword, body<8KB)
LIKELY_BROKEN    ← 2xx + body < 200 bytes (empty-body heuristic)

CONFIRMED_BROKEN ← 410 → reason='gone'
CONFIRMED_BROKEN ← 404 → reason='not_found'
CONFIRMED_BROKEN ← 451 → reason='legal_block'
CONFIRMED_BROKEN ← 400, 409, 412, 422 → reason='client_error' (debatable but kept)
CONFIRMED_BROKEN ← escalation: dns_nxdomain (N≥4) / tls (N≥8) / refused (N≥8)
CONFIRMED_BROKEN ← oEmbed 404 for always-alive domain → reason='gone_platform'

UNKNOWN          ← 5xx after retry → reason='server_error'
UNKNOWN          ← 511 → reason='captive_portal'
UNKNOWN          ← 401 → reason='auth_required' or 'bot_challenge_suspected'
UNKNOWN          ← 403 (post-GET fallback) → reason per header/body discrimination
UNKNOWN          ← 405 (post-GET, GET not in Allow) → reason='method_not_allowed'
UNKNOWN          ← 406, 415, 416 (retry with Accept:* failed) → reason='content_negotiation'
UNKNOWN          ← 408, 425, 429 → reason='rate_limited' or 'transient'
UNKNOWN          ← 421, 426, 428, 431 → reason='transient'
UNKNOWN          ← network error (DNS/TLS/reset/timeout) → reason per error type
UNKNOWN          ← residual 3xx (308 cap hit) → reason='redirect_cap'
```

### 7.3 Escalation ladder (deterministic, per-reason)

```
consecutive_unknown_count increments each weekly run the verdict is 'unknown'
with the same reason family. Resets to 0 on any non-unknown verdict.

dns_nxdomain    → confirmed_broken at N≥4 (28 days) — RFC 8020 + registrar lifecycle
tls_failure     → confirmed_broken at N≥8 (56 days) — cert renewal window
connection_*    → confirmed_broken at N≥8 (56 days) — server genuinely down
timeout         → stay unknown forever (amber), but UI shows "unreachable for N weeks"
bot_challenge*  → stay unknown forever (the platform is up; we're blocked)
rate_limited*   → stay unknown forever (the resource is fine; we're throttled)
server_error*   → stay unknown forever (the server is transiently broken)
captive_portal  → stay unknown forever (the network is intercepting; not the resource)
```

### 7.4 State diagram (target)

```mermaid
stateDiagram-v2
  [*] --> alive: bookmark created (optimistic default)
  alive --> alive: 2xx & no soft-404; or 304; or oEmbed-verified
  alive --> likely_broken: 2xx + soft-404 (Tier-1/2)
  alive --> confirmed_broken: 410/404/451; or 400/409/412/422; or oEmbed 404
  alive --> unknown: 5xx retry-exhausted; 401/403; 408/425/429; network error
  likely_broken --> alive: next run, 2xx & no soft-404
  likely_broken --> likely_broken: next run, 2xx + soft-404
  likely_broken --> confirmed_broken: next run, 4xx/410/451
  likely_broken --> unknown: next run, 5xx/network
  confirmed_broken --> alive: next run, 2xx (recovers)
  confirmed_broken --> confirmed_broken: next run, still 4xx
  confirmed_broken --> unknown: next run, 5xx/network
  unknown --> alive: next run, 2xx (recovers)
  unknown --> confirmed_broken: next run, 4xx; OR escalation (dns N≥4, tls N≥8)
  unknown --> unknown: next run, still unreachable (count++)
  alive --> [*]: user deletes bookmark
  likely_broken --> [*]: user deletes bookmark
  confirmed_broken --> [*]: user deletes bookmark
  unknown --> [*]: user deletes bookmark
```

### 7.5 Determinism & simplicity check (target)

- **No state-dependent branching in the classifier.** `checkUrl` is a pure
  function of the fetch outcome. The escalation ladder is a post-persist
  step that reads `consecutive_unknown_count` — it does not feed back into
  the classifier.
- **No hidden transitions.** The classification rules in §7.2 cover every
  terminal. The escalation ladder is the only stateful operation, and it's
  a one-way promotion (`unknown` → `confirmed_broken`) gated by a count.
- **Reversible.** Any misclassification self-heals on the next run: a
  recovered server flips `confirmed_broken` → `alive`; a transient 5xx flips
  `unknown` → `alive`. The escalation ladder resets `consecutive_unknown_count`
  to 0 on any non-`unknown` verdict.
- **4 states.** No fifth state added. All improvements are metadata
  (`reason`, `consecutive_unknown_count`, optional `confidence`) or
  classifier-internal refinements (tiered soft-404, split 4xx).
- **Spec-correct.** Every status code is classified per its RFC-defined
  semantics. 5xx, 429, 408, 425, 511, 304 are all corrected.
- **Honest.** `http_status` reflects a real HTTP response (or NULL for
  always-alive, with `reason='always_alive'` to explain the NULL).
- **Measurable.** `reason` and `consecutive_unknown_count` enable per-reason
  FP/FN tracking and confidence scoring.

### 7.6 What this target machine does NOT add

- No new persisted states (still 4).
- No user-facing override (ADR-0002's stance preserved).
- No sticky/skip-once-seen-broken logic (weekly overwrite preserved).
- No plugin system (out of scope; the 4-state + tiers model covers 95%).
- No JS-rendering / headless browser (out of scope; 200 + empty SPA is
  alive by definition — the resource exists, the browser renders it).
- No per-user accept lists (the 4-state model is the right default for 95%
  of users; power-user config is P3+).

The target machine is the current machine with: spec-correct 5xx/429/408/425
handling, tiered soft-404, persisted `reason`, and a deterministic
escalation ladder. Everything else is observability and future features that
slot in without touching the core classifier.

---

## Appendix A — Confidence score derivation (reference for §6.19)

A reference mapping from `(verdict, reason)` to a 0–100 confidence score.
This is a derivation function, not a persisted field, until 6.19 ships.

| Verdict          | Reason                             | Confidence                         |
| ---------------- | ---------------------------------- | ---------------------------------- |
| confirmed_broken | gone (410)                         | 99                                 |
| confirmed_broken | not_found (404)                    | 95                                 |
| confirmed_broken | legal_block (451)                  | 85                                 |
| confirmed_broken | client_error (400/409/412/422)     | 75                                 |
| confirmed_broken | dns_nxdomain_persistent (N≥4)      | 90                                 |
| confirmed_broken | tls_persistent (N≥8)               | 70                                 |
| confirmed_broken | unreachable_persistent (N≥8)       | 65                                 |
| confirmed_broken | gone_platform (oEmbed 404)         | 95                                 |
| likely_broken    | soft404_canonical                  | 90                                 |
| likely_broken    | soft404_error_class                | 88                                 |
| likely_broken    | soft404_json_error                 | 85                                 |
| likely_broken    | soft404_combined                   | 75                                 |
| likely_broken    | soft404_empty_body                 | 60                                 |
| alive            | ok (2xx + no soft-404)             | 95                                 |
| alive            | not_modified (304)                 | 90                                 |
| alive            | ok_binary (non-HTML 2xx)           | 95                                 |
| alive            | always_alive (oEmbed verified)     | 90                                 |
| alive            | always_alive (synthetic, pre-6.16) | 0                                  |
| unknown          | server_error (5xx)                 | 10 (server broken, not resource)   |
| unknown          | rate_limited                       | 5 (resource fine, we're throttled) |
| unknown          | bot_challenge*                     | 5 (platform up, we're blocked)     |
| unknown          | captive_portal                     | 0 (network issue, not resource)    |
| unknown          | timeout                            | 15 (could be slow server or dead)  |
| unknown          | network_error (DNS/TLS/refused)    | 20 (could be dead or transient)    |

---

## Appendix B — Mapping to the companion audit

This review references the audit (`docs/broken-link-detection-audit.md`)
throughout. Cross-reference:

| This review       | Audit section                            |
| ----------------- | ---------------------------------------- |
| §2 R-A            | Audit §5 R-A (always-alive)              |
| §2 R-B            | Audit §5 R-B (401/403 → unknown)         |
| §2 R-C            | Audit §5 R-C (410/451)                   |
| §2 R-D            | Audit §5 R-D (5xx)                       |
| §2 R-E            | Audit §5 R-E (other 4xx)                 |
| §2 R-F            | Audit §5 R-F (soft-404 gate)             |
| §2 R-G            | Audit §5 R-G (keyword/title singletons)  |
| §2 R-H            | Audit §5 R-H (errors → unknown)          |
| §2 R-I            | Audit §5 R-I (HEAD→GET fallback)         |
| §2 R-J            | Audit §5 R-J (finalUrl discarded)        |
| §2 R-K–R-N        | (New — surfaced by this review)          |
| §3 scenarios      | Audit §3 (state transition matrix)       |
| §4 threat model   | Audit §5 (per-rule FP/FN analysis)       |
| §5 extensibility  | Audit §6 (improvement roadmap)           |
| §6 roadmap        | Audit §6 (superset, reordered by impact) |
| §7 target machine | Audit §7 (recommended final machine)     |

The audit asks "what does the code do?"; this review asks "is that the right
thing to do?" Together they form the complete design record.

---

## Appendix C — Industry references

- **RFC 9110** — HTTP Semantics (2022). Status code definitions §15.
- **RFC 9111** — HTTP Caching (2022). 304, `Retry-After`.
- **RFC 6585** — Additional HTTP Status Codes. 429, 511.
- **RFC 7725** — HTTP Status Code 451.
- **RFC 7538** — HTTP Status Code 308.
- **RFC 8020** — NXDOMAIN semantics.
- **lychee** — `lychee.cli.rs/guides/cli`. Default GET, `--accept
100..=103,200..=299`, `--max-retries 3`, `--timeout 20`.
- **Google Search Console** — "Crawl Errors now reports soft 404s" (2010).
  `developers.google.com/search/blog/2010/06/crawl-errors-now-reports-soft-404s`.
- **DubBot** — Broken link status codes reference.
  `help.dubbot.com/en/articles/5170997-broken-link-status-codes`.
- **W3C link checker** — `validator.w3.org/checklink`.

---

_End of design review. For the implementation audit with `file:line`
provenance, see `docs/broken-link-detection-audit.md`._
