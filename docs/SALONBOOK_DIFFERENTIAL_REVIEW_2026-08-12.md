# SalonBook differential security review — 2026-08-12

Review status: **final for the frozen local working-tree snapshot**

## Executive Summary

| Severity | Active findings |
| --- | ---: |
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🟢 Low | 2 |

**Overall risk:** MEDIUM

**Recommendation:** CONDITIONAL

No active Critical or High security regression was found in the reviewed working
tree. The branch is suitable to merge for a controlled demonstration that uses
synthetic people and leaves outbound SMS disabled. It is **not** ready for an
unattended real-customer pilot or broad public traffic until the external gates
in `docs/PILOT-READINESS.md` are evidenced and the Medium findings below are
mitigated or explicitly accepted by the production owner.

The most material residual risk is the intentionally unauthenticated public
booking surface. A direct client can satisfy the browser-oriented Origin check;
distributed automation can therefore reserve genuine inventory and, once SMS is
enabled, cause billable customer and owner submissions. The durable outbox also
has at-least-once rather than exactly-once provider semantics, including an
avoidable duplicate window when the audit-log insert fails after provider
acceptance.

**Key metrics**

- Review target: base `fd8804c20a6ce038e44ea91b8dae6671d207f5c5`
  versus the current uncommitted working tree.
- Files analyzed: 101/101 changed or new files (100% inventory); all auth,
  booking, database, limiter, invitation, notification, and provider paths were
  reviewed deeply, while UI, legal copy, market research, and low-risk test
  fixture changes received a surface scan.
- Change size at the final snapshot: +8,803/-470 lines across 101 files
  (58 tracked modifications and 43 untracked files; the review report itself is
  excluded).
- High-blast-radius security boundaries: the business auth helper reaches 21 API
  route modules, customer auth reaches 4, admin auth reaches 5, and the shared
  limiter reaches 6 protected API routes.
- Security regressions in the final snapshot: 0. Seven material defects observed
  in intermediate review states were fixed and retested; see “Resolved during
  review.”
- Known high-risk test gaps: no live Africa's Talking/handset/delivery-receipt
  test, no distributed abuse/spend test, no audit-log-failure-after-provider-
  acceptance test, and no deterministic cancellation-versus-send race test.
- Confidence: HIGH for the code-level auth, CSRF, tenant, migration, booking,
  limiter, invitation, and notification paths; MEDIUM for real provider and
  deployment behavior because production/external systems were explicitly out
  of scope.

## What Changed

**Commit range:** `fd8804c20a6ce038e44ea91b8dae6671d207f5c5` → working tree

**New commits in range:** 0; all reviewed changes are currently uncommitted

**Baseline date:** 2026-08-11

**Review date:** 2026-08-12

| Exclusive area | Files | Primary risk |
| --- | ---: | --- |
| Root configuration and CI | 8 | High: headers, environment, deployment, test execution |
| Documentation | 3 | Low/operational: legal and production claims |
| API routes | 19 | High: authentication, CSRF, authorization, public writes |
| App UI/pages | 16 | Medium: capability handling, data display, client auth |
| Components | 4 | Low: presentation and public links |
| Library/services/migrations | 23 | High: identity, database, booking, providers, queue |
| Types | 1 | Low |
| Unit tests | 16 | Medium: security invariant evidence |
| Integration tests | 6 | High: PostgreSQL behavior and migration evidence |
| End-to-end tests | 5 | Medium: browser behavior and security headers |
| **Total** | **101** | **+8,803/-470 lines** |

The worktree changes the product boundary materially:

1. Browser authentication moves from JavaScript-readable `localStorage` bearer
   tokens to role-specific HttpOnly cookies, with same-origin checks for ambient
   credential mutations and temporary non-ambient bearer compatibility.
2. Business onboarding becomes invitation-only through 256-bit, email-bound,
   expiring, one-use capabilities whose SHA-256 digests are stored in PostgreSQL.
3. PostgreSQL-backed, HMAC-keyed hierarchical rate limits protect six public
   authentication/signup/booking routes through migration 006.
4. Booking creation and first cancellation now atomically create durable,
   PII-minimized notification intents through migration 007. A protected worker
   leases them with `SKIP LOCKED` and submits SMS through Africa's Talking only
   when an explicit feature flag and valid configuration are present.
5. Migration 008 enforces normalized business-email uniqueness and installs the
   private invitation table. The public listing boundary is tightened to active
   businesses, with an owner-only preview for pending listings.
6. Security headers, legal/pilot runbooks, readiness gating, disabled future
   payment/WhatsApp/Stripe modules, and substantially expanded unit,
   PostgreSQL-integration, and Firefox coverage are added.

## Critical Findings

There are no active Critical or High findings. The section records every active
Medium and Low issue because each affects the production decision.

### 🟡 M-01: Distributed public booking can exhaust inventory and trigger billable SMS

**Files:**

- `src/app/api/bookings/route.ts:L50-L53`, `L86-L89`, `L135-L158`
- `src/lib/security/rate-limit.ts:L95-L100`, `L307-L395`
- `src/lib/services/booking.service.ts:L401-L660`
- `src/lib/services/notification-outbox.service.ts:L56-L70`
- `src/lib/modules/sms/index.ts:L103-L149`, `L249-L373`

**Commit:** uncommitted working tree

**Blast radius:** the public booking write, every active salon's available
inventory, two creation notification intents per accepted booking, and the
Africa's Talking account after SMS activation

**Test coverage:** PARTIAL — pair/network concurrency and row-growth behavior are
tested, but distributed business/spend abuse is not

**Description**

The route correctly rejects cross-site browser requests and enforces 10 attempts
per trusted-network/phone pair plus 100 per trusted network per 10 minutes. That
is a CSRF and coarse abuse boundary, not proof that a booking comes from a human
or from the owner of the submitted phone. A non-browser client can send
`Content-Type: application/json` and a target-site `Origin` header. There is no
per-business successful-booking ceiling, global SMS-cost circuit breaker,
challenge, or verified-phone step.

This behavior is reachable by design: the service accepts guest bookings, public
endpoints disclose active services/staff/slots, and every accepted booking
reserves a real slot and enqueues both a customer confirmation and owner alert.
The current SMS feature flag defaults off, which is an important compensating
control for demonstrations.

**Attack scenario**

1. An attacker enumerates an active salon's public services, staff, and future
   availability.
2. A script submits same-origin-looking JSON directly, rotating valid Kenyan
   phone numbers and, if needed, source networks.
3. Each transaction passes the normal availability checks, commits a booking,
   removes that slot from legitimate inventory, and creates two durable SMS
   intents.
4. One source network can attempt up to 100 bookings per 10 minutes; distributed
   clients are not bounded by a product-wide or per-business success budget.
5. With SMS enabled, the campaign also sends attacker-controlled booking context
   to submitted numbers and repeated owner alerts, consuming provider spend.

**Recommendation**

- Keep `SMS_NOTIFICATIONS_ENABLED=false` outside a supervised sandbox until edge
  controls are proven.
- Before public traffic, add Vercel WAF/bot rules or a challenge, a per-business
  successful-booking velocity cap, a global notification-cost cap, alerts, and
  an automatic/provider-side SMS spend kill switch.
- Add risk-based phone OTP or another proof-of-control step before treating a
  phone as notification-authorized; preserve an accessible fallback for genuine
  customers.
- Load-test realistic carrier-NAT and distributed abuse patterns so a mitigation
  does not lock out ordinary Kenyan mobile users.

### 🟡 M-02: Provider acceptance followed by audit failure is retried as a duplicate SMS

**Files:**

- `src/lib/services/notification.service.ts:L17-L33`, `L47-L70`
- `src/lib/services/notification-outbox.service.ts:L468-L471`, `L493-L531`
- `README.md:L149-L152`

**Commit:** uncommitted working tree

**Blast radius:** all three SMS types and both dispatch entry points (post-booking
`after()` and the protected recurring worker)

**Test coverage:** PARTIAL — provider acceptance, retry, lease loss, and audit
content are tested independently; the combined post-acceptance audit failure is not

**Description**

`sendAndLogBookingSms` first performs the irreversible provider call and then
awaits `notification_logs` insertion. If Africa's Talking accepted the message
but the audit insert throws, the accepted `SmsSendResult` never reaches the
dispatcher. The catch path marks the outbox row for retry. The next attempt can
submit the same SMS again. A worker crash after provider acceptance but before
`markAccepted` creates the separate, documented at-least-once duplicate window.

**Failure scenario**

1. The worker leases a confirmation and Africa's Talking returns an accepted
   message ID.
2. PostgreSQL transiently rejects or times out the subsequent
   `notification_logs` insert.
3. `sendAndLogBookingSms` throws; the dispatcher records a generic retry instead
   of persisting the provider acceptance on the outbox row.
4. After backoff or lease expiry, the worker submits the same message again.
5. The customer can receive duplicates and the operator can be charged twice.

**Recommendation**

- Preserve and return an accepted provider result even if the secondary audit
  insert fails, then durably mark the outbox accepted with its provider message
  ID. Log the audit failure using redacted metadata and reconcile missing audit
  rows separately.
- Add a failure-injection test for “provider accepted; audit insert failed.”
- Where the provider permits it, use an idempotency/deduplication key tied to the
  outbox row. Add delivery-receipt ingestion before describing acceptance as
  handset delivery.

### 🟢 L-01: Cancellation can race after preflight and still send a stale confirmation

**Files:**

- `src/lib/services/notification-outbox.service.ts:L375-L393`, `L493-L531`
- `src/lib/services/booking.service.ts:L727-L787`
- `src/lib/services/customer.service.ts:L131-L186`

**Commit:** uncommitted working tree

**Blast radius:** creation confirmation and owner-alert jobs during concurrent
cancellation/status transition

**Test coverage:** PARTIAL — cancellation before claim and status mismatch at
preflight are tested; cancellation between preflight and provider I/O is not

**Description**

The worker rechecks the lease and booking status immediately before provider I/O,
which closes the long stale-queue window. The SELECT does not lock or version the
booking across the external call. A cancellation can therefore commit after the
preflight reports `Booked` but before `sendSms` reaches the provider. The
cancellation clears the lease, so `markAccepted` later fails, but it cannot undo
an already submitted confirmation.

**Concrete race**

1. Worker preflight reads a valid processing lease and `Booked` status.
2. Owner/customer cancellation locks and changes the booking to `Cancelled`,
   dead-letters creation intents, and commits.
3. The worker, holding the earlier in-memory job, submits “confirmed.”
4. The cancellation message can subsequently be submitted as well.

**Recommendation**

Document this narrow external-side-effect boundary and add a deterministic race
test. Before claiming strong ordering, introduce a reviewed state/version
protocol that defines when cancellation may supersede a leased send; do not hold
ordinary database row locks across an unbounded provider call.

### 🟢 L-02: Physical rate-limit retention still depends on traffic or an external job

**Files:**

- `src/lib/security/rate-limit.ts:L9-L10`, `L119-L129`, `L260-L267`
- `README.md:L186-L203`
- `docs/PILOT-READINESS.md:L43-L56`
- `docs/PRIVACY-OPERATIONS.md:L163-L175`

**Commit:** uncommitted working tree

**Blast radius:** `rate_limit_windows` storage/privacy operations

**Test coverage:** YES for a bounded 250-row request-path cleanup; NO for a
scheduled production cleanup because none is provisioned in this repository

**Description**

Counters stop affecting requests when their fixed window changes, and the latest
implementation deletes up to 250 physically expired rows every 32 protected
requests. This is sufficient fallback throughput for the current maximum of five
new buckets per request, but it cannot guarantee physical deletion during idle
periods or rapidly drain a large historical backlog. README and pilot readiness
correctly require an indexed scheduled cleanup and size alert. The privacy table's
“Automatic expiry” wording can still be read as an implemented physical TTL even
though the job remains external.

**Recommendation**

- Provision and monitor a bounded indexed deletion job before broad public
  traffic, then rehearse it against realistic backlog sizes.
- Change the privacy schedule to distinguish logical quota expiry from physical
  row deletion and name the job/owner once provisioned.

## Resolved During Review

These are not counted as active findings. They are retained to make the security
decisions and regression-sensitive tests visible.

| Prior severity | Intermediate defect | Final control/evidence |
| --- | --- | --- |
| High | Cookie login/signup/logout initially allowed login CSRF through cross-site simple requests. | `sameOriginJsonMutationGuard` now requires JSON and exact Origin at all auth mutations; cookie-auth mutations also enforce Origin centrally. |
| High | Public booking initially allowed cross-site booking and SMS amplification. | The public write now uses the same JSON/Origin guard before body parsing or mutation. |
| High | The documented example JWT secret could have been deployed unchanged and used to forge every role. | `.env.example` leaves it blank; `getJwtSecret` rejects missing, short, whitespace-altered, and known placeholder values. |
| High | Earlier limiter ordering/global identity choices allowed one network to burn another user's quota and allowed identity-row growth after network saturation. | Final order is network → pair → optional principal, with early returns; public booking and invitation-only business signup have no global principal lock. Real PostgreSQL tests cover concurrency, HMAC-only storage, and post-saturation row caps. |
| Medium | Stale creation alerts and repeated cancellation transitions could produce incorrect/repeated cancellation SMS. | Transactional status machine, intent invalidation, unique intent keys, claim filtering, and preflight checks now cover normal/recovery cases. L-01 records the remaining narrow network-I/O race. |
| Medium | SMS response parsing could wait on or buffer an unbounded provider body. | The request and body read share a 1–10 second abort deadline and a 64 KiB streaming cap. |
| Medium | Invitation capability fallback in a query string exposed tokens to HTTP/referrer surfaces. | Admin links are fragment-only, responses are no-store/no-referrer, signup ignores query tokens and removes the accepted fragment from history. |

## Test Coverage

### Results on the final frozen snapshot

| Check | Result | Notes |
| --- | --- | --- |
| PostgreSQL 17 migrations 001–008 + integration | ✅ 38/38 | Reported by the coordinating reviewer on a fresh local safety-checked database |
| Immediate migration checksum rerun + integration | ✅ 38/38 | Confirms tracked checksums and idempotent rerun behavior |
| Unit suite | ✅ 143/143 | Full current unit suite |
| Focused high-risk unit suite | ✅ 110/110 | Independently rerun across 15 auth/booking/limiter/invite/SMS/outbox files |
| Lint | ✅ | Independently rerun with zero warnings |
| Typecheck | ✅ | Independently rerun (`next typegen` + `tsc --noEmit`) |
| Coverage command | ✅ | 36.57% statements, 34.13% branches, 44.32% functions, 38.05% lines; no configured threshold |
| Production build | ✅ | 45 routes built |
| Production-mode Firefox suite | ✅ 10/10 in 44.8s | Nine deterministic fixture tests plus one real-stack canary; includes CSP/header assertion |
| Real-stack Firefox booking canary | ✅ 1/1 (included above) | Actual Next UI → POST → local safety-checked PostgreSQL booking, exact snapshot, and two pending durable intents |
| `git diff --check` | ✅ | No whitespace errors |
| `npm audit --omit=dev --audit-level=high` | ✅ | 0 vulnerabilities |

### Strong coverage added

- Auth algorithm/issuer/audience/role validation, cookie flags, token omission,
  cross-origin login/logout/mutation rejection, stale business/admin identity,
  and role separation.
- Real PostgreSQL limiter migration tracker/checksum, RLS, exposed privileges,
  atomic concurrency, HMAC-only identifiers, bounded cleanup, trusted-network
  behavior, and row-growth cap after network exhaustion.
- Booking/outbox same-transaction commit and forced rollback, unique creation and
  cancellation intents, concurrent `SKIP LOCKED` workers, lease expiry, stale
  dead-lettering, cancellation invalidation, terminal state rules, and customer
  cancellation ownership.
- Invitation migration privacy/indexes, raw-token non-persistence/non-echo,
  email binding, expiry, concurrent one-use redemption, rollback, and
  supersession.
- SMS configuration fail-closed behavior, Kenyan E.164 normalization, fixed
  endpoints, sender rules, structured provider acceptance/rejection, response
  cap, timeout, and secret-safe errors.

### Remaining coverage gaps

| Gap | Risk | Required evidence |
| --- | --- | --- |
| Live Africa's Talking sandbox, handset, and delivery receipts | Medium | End-to-end sandbox submission, callback authentication, delivery reconciliation, and no-PII logging review |
| Distributed booking/inventory/SMS-spend abuse | Medium | WAF + application load scenario across networks, identities, businesses, and cost ceilings |
| Provider accepted then `notification_logs` insert fails | Medium | Failure-injection test proving no duplicate retry from secondary audit failure |
| Cancellation after preflight but before provider submission | Low | Deterministic interleaving test and documented state protocol |
| Notification outbox PostgREST privilege assertion | Low | Match migration 006/008 tests by asserting PUBLIC/anon/authenticated have no privileges on migration 007's table |
| Full business-invitation browser journey | Low | Admin create → copy fragment link → signup UI → pending business against real PostgreSQL |

The numeric coverage percentage is not an approval threshold. Targeted security
scenario coverage is materially stronger than the aggregate number, but future
CI should set a realistic floor and ratchet it upward.

The first real-stack attempt correctly failed the strict Origin check because
the browser harness used `127.0.0.1` while Next reconstructed `localhost` as the
canonical origin. The harness was corrected to the canonical host, retained the
unchanged same-origin guard, and simulated only Vercel ingress (`VERCEL=1` plus
the canary's `x-vercel-forwarded-for`). The complete production-mode Firefox
suite then passed on the frozen snapshot.

## Blast Radius

| Boundary | Quantified callers/entry points | Security impact |
| --- | ---: | --- |
| `requireAuth` | 21 API route modules | All business-owner reads/writes and tenant scoping |
| `requireCustomerAuth` | 4 API route modules | Customer profile, bookings, cancellation, reviews |
| `requireAdminAuth` | 5 API route modules | Business activation, listing, stats, invitations |
| Auth mutation guards | 10 request entry points | Five login/signup, three logout, admin invitations, public booking |
| Session response helpers | 5 credential-creation and 3 credential-clearing routes | Every browser session cookie |
| `enforceRateLimit` | 6 API route modules | Business/customer/admin login, both signups, public booking |
| Booking creation | 1 public route, 1 service transaction | Inventory, guest identity, promotion counters, price snapshots, two outbox intents |
| Status/cancellation | 2 API callers, 2 service state transitions | Tenant/customer ownership and cancellation intent |
| Notification dispatch | 2 entry points | Post-response opportunistic dispatch and protected cron worker |
| SMS submission | 3 notification types | Customer confirmation/cancellation and owner alert |
| Invitation creation/redemption | 1 admin route and 1 business signup route | Capability issuance and new tenant creation |

The shared auth change is the largest direct code blast radius. It is nonetheless
well bounded: role-specific cookie names prevent cross-role reuse, business/admin
identities are checked against current database state, bearer credentials are
non-ambient, and every cookie-authenticated unsafe method requires same-origin
intent. Public/read-only owner-preview helpers do not bypass mutation checks.

The database blast radius is operational rather than caller-count based.
Migrations must be applied in order 006 → 007 → 008 before deploying code that
uses the new tables. The existing strict Supabase TLS configuration remains
unchanged from `c72e8f9`, strips URL SSL overrides, requires the production CA,
and sets `rejectUnauthorized: true`. The runtime pool remains bounded with
connection, query, and statement timeouts.

## Historical Context

| Commit | Date/context | Security relevance |
| --- | --- | --- |
| `fc3324f` | Initial SalonBook commit | Introduced public booking, JavaScript-readable bearer sessions, and notification stubs |
| `6557520` | Customer portal | Added the separate customer auth/booking boundary |
| `1617a25` | Booksy-style upgrade | Expanded staff, CRM, discovery, promotions, and notification behavior |
| `c564f1e` | Admin panel | Added platform-admin activation and statistics surfaces |
| `e0d941a` | Recovery/hardening | Added core booking integrity, tenant hardening, and migrations through 004 |
| `c72e8f9` | Strict Supabase TLS | Added CA verification and rejected connection-string SSL downgrades |
| `fd8804c` | Recovery rollout documentation | Review baseline and current committed HEAD |

`git log -S` traces the removed `salonbook_token` pattern and the original SMS
stub to `fc3324f`. The current change removes browser token writes rather than
removing an older security guard. It also replaces console/payload-heavy SMS
stubs with a disabled-by-default provider and a PII-minimized outbox. No code
introduced by the prior recovery/security commits was removed without an equal
or stronger replacement.

All new application lines are uncommitted, so they have no meaningful per-line
commit attribution yet. Findings above identify the working tree explicitly;
the baseline commit table provides the relevant historical provenance.

## Recommendations

### Immediate (merge decision)

- [x] Completed the real-stack Firefox canary and final verification sequence on
  the frozen snapshot: lint, typecheck, unit, integration/checksum, build,
  Firefox, audit, and `git diff --check` all passed.
- [x] Final inventory contains no generated `output/`, test database artifact,
  or secret-bearing environment file.
- [x] Preserved the regression tests for same-origin auth/booking, placeholder
  secret rejection, limiter hierarchy, invitation fragments, and outbox status
  filtering.

No active Critical/High item blocks a controlled-demo merge.

### Before real customer data or SMS production

- [ ] Mitigate M-01 with WAF/bot controls, per-business/global success and spend
  ceilings, alerts, and a tested kill switch; keep provider sending disabled until
  then.
- [ ] Fix or explicitly accept M-02 and add the post-acceptance audit-failure test.
- [ ] Provision the paid-plan five-minute worker, strong independent secrets,
  scheduled limiter cleanup, size/dead-letter/429/5xx alerts, and privacy-safe
  error monitoring.
- [ ] Apply migrations 001–008 through a direct/session port 5432 connection only
  after a verified backup; verify checksums, staging smoke tests, and a restore.
- [ ] Complete Africa's Talking sandbox testing and authenticated delivery-receipt
  reconciliation. Provider “accepted” must never be presented as handset
  delivery.
- [ ] Name the legal operator, support/privacy/incident owners, obtain Kenyan
  privacy/terms/DPA review, decide retention and cross-border safeguards, and
  rehearse export/deletion/incident procedures.
- [ ] Use only salon-authorized public profile data and explicit authorization
  before activating a real listing.

### Before broader production scale

- [ ] Replace stateless seven-day JWT-only sessions with revocable sessions,
  password reset, rotation, and owner/admin MFA; retire legacy bearer support by
  forward-only release after old clients drain.
- [ ] Add provider-side or application-level deduplication, delivery receipts,
  notification retention/deletion, and a deterministic cancellation/send state
  protocol.
- [ ] Add risk-based verified-phone flows before guest-booking claiming or phone-
  authoritative actions. Never merge bookings by matching name/phone text alone.
- [ ] Keep M-Pesa, WhatsApp, Stripe, deposits, and online rescheduling disabled
  until their separate ledger, callback-authentication, reconciliation, refund,
  consent, and legal gates are implemented and tested.
- [ ] Raise aggregate automated coverage from 36.57% statements with a CI threshold while
  maintaining real PostgreSQL and browser security scenarios.

## Analysis Methodology

**Strategy:** FOCUSED differential review for a medium-sized change set, with
100% deep coverage of High-risk paths and a surface scan of every remaining file.

**Techniques applied**

1. Built the baseline from repository history and recovery commits, then
   inventoried tracked and untracked changes against `fd8804c`.
2. Classified auth, cookies/CSRF, authorization, public booking, migrations,
   tenant boundaries, rate limiting, notification queues, provider I/O, and
   secrets as High-risk regardless of diff size.
3. Read those implementations and their one-hop callers/dependencies end to end;
   searched all 46 API route modules for authorization and all 28 mutation-route
   modules for ambient credential behavior.
4. Used `git log`, `git blame`, and pickaxe searches to determine why removed
   token/stub/TLS patterns existed and whether a security control regressed.
5. Quantified symbol callers and entry points with `rg`; inspected SQL parameter
   use, transaction/lock order, migration tracking/checksums, RLS/revokes,
   provider timeouts, and state-machine invariants.
6. Constructed concrete attacker/failure interleavings only where the public
   route or operational state makes them reachable.
7. Inspected targeted unit, PostgreSQL-integration, fixture E2E, and real-stack
   canary tests; independently ran non-mutating lint, typecheck, focused unit,
   audit, and diff checks. Database-mutating test results in this report are
   attributed to the coordinating reviewer, who ran them against a local
   safety-checked PostgreSQL 17 test database.
8. Validated the production proxy assumption against Vercel's official request
   header documentation: Vercel identifies `x-vercel-forwarded-for` as the
   platform copy of the overwritten anti-spoofing client-IP header. See
   [Vercel request headers](https://vercel.com/docs/headers/request-headers).

**Coverage limits**

- Production, Supabase, Vercel project settings, provider accounts, DNS, live
  secrets, real phones, and external writes were out of scope.
- This is a differential review, not a complete penetration test or legal
  opinion. Pre-existing code was traced when it governed a changed boundary but
  was not exhaustively audited feature by feature.
- The worktree was frozen for the final inventory and line-reference refresh.
  These findings apply to that exact local snapshot; any subsequent edit needs
  proportionate re-review and retesting.
- No live provider response, WAF behavior, restore, paid cron cadence, or
  delivery receipt was asserted.

**Confidence:** HIGH for current code paths and local PostgreSQL invariants;
MEDIUM for deployment/provider outcomes.

## Appendices

### A. Security invariants verified in code

- JWT: HS256 only; issuer and audience fixed; payload shape/role validated;
  strong non-placeholder secret required.
- Sessions: distinct business/customer/admin HttpOnly cookies; Secure in
  production; SameSite=Lax; path `/`; no token in login/signup JSON; unsafe
  cookie mutations require exact same-origin intent.
- Tenant boundary: business IDs come from validated role credentials and current
  account state; owner/admin/customer queries constrain tenant or customer IDs;
  public business/profile/service/staff data is limited to active listings except
  exact authenticated owner preview.
- Booking: validated active tenant/service/staff, Nairobi database clock,
  schedules/blocks/overlap/buffer, advisory serialization, promotion reservation,
  price snapshots, booking row, and two outbox intents share one transaction.
- Cancellation: tenant/customer row lock, terminal-state rules, creation-intent
  invalidation, and one unique cancellation intent share one transaction.
- Rate limiting: trusted Vercel network boundary, independent 32+ byte HMAC key,
  HMAC-only database identifiers, atomic fixed-window upsert, saturated counters,
  network-first hierarchy, bounded cleanup, fail-closed 503.
- Invitations: 256-bit random raw token, digest-only storage, email binding,
  bounded expiry, admin issuance, fragment-only delivery, advisory/row locks,
  one committed redemption with account creation in the same transaction.
- Notifications: PII-minimized durable intents, unique booking/type key, bounded
  lease/retry/staleness, protected worker, fixed provider endpoints, explicit
  opt-in, strict config, E.164 normalization, timeout/body bounds, generic errors,
  and no claim that provider acceptance equals delivery.
- Database: strict Supabase CA verification, bounded runtime pool/timeouts,
  parameterized changed queries, migration advisory lock and checksums, RLS and
  revokes for private tables.

### B. Informational observations

- The CSP materially improves framing/object/form/base restrictions, but
  production `script-src` still includes `'unsafe-inline'`. That is compatible
  with the current Next rendering approach and no reachable raw-HTML injection
  was found; a nonce/hash migration would be defense in depth.
- `sendSms` returns immediately on a non-201 response without explicitly
  consuming/canceling its body (`src/lib/modules/sms/index.ts:L309-L315`). The
  request timeout bounds the fetch itself, but explicit cancellation would make
  connection/resource handling less implementation-dependent.
- The public health endpoint performs one `SELECT 1` per uncached request. Keep
  it behind ordinary platform/WAF monitoring so it cannot become a cheap database
  amplification endpoint.

### C. Final sign-off record

1. [x] The working tree was frozen for final review.
2. [x] The real-stack canary and final full suite passed on that exact snapshot.
3. [x] Change totals and finding line references were refreshed.
4. [x] `git status` contained only the reviewed source, test, configuration,
   documentation, and this report; no generated output or secret file was
   present.
