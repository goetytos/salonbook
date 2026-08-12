# SalonBook privacy and pilot operations runbook

Last reviewed: 2026-08-12

Status: operational draft for guided demos and pilot preparation

This runbook is not legal advice, a compliance certificate, or permission to
process real customer data. It does not change production. The operator and a
Kenyan privacy professional must approve the marked decisions before the first
real-business pilot.

## How to read this runbook

- **Implemented software control** — present in the current pilot code or
  recovery evidence, but still requires deployment-specific verification.
- **Draft process** — a human procedure proposed here; it is not automated or
  proven until an owner is named and a rehearsal passes.
- **External decision** — requires the operator, salon, provider, or qualified
  Kenyan adviser. Software work cannot decide it.

The Kenya Data Protection Act uses controller and processor roles. The working
model for a pilot is:

- A salon is likely the **controller** for its clients, staff, appointments and
  service records when SalonBook processes them only on the salon's instructions.
- The SalonBook operator is likely a **processor** for those records.
- The SalonBook operator is likely a separate **controller** for platform-owner
  accounts, platform security, support, billing and its own marketing.
- A purpose decided jointly, an import, or reuse of booking data can change that
  allocation.

That model is an operational hypothesis, not a legal conclusion. **External
decision:** Kenyan counsel must confirm the roles and the relevant ODPC
registration obligations before a real pilot.

## Named roles before real data

Replace every placeholder below and keep the contacts in the restricted
operations register, not in the public repository.

| Responsibility | Named person and private contact | Required before |
| --- | --- | --- |
| Legal operator / contract signatory | `[LEGAL OPERATOR NAME]` | Salon contract |
| Privacy lead and 24-hour escalation | `[PRIVACY LEAD / PHONE / EMAIL]` | Real data |
| Incident commander | `[INCIDENT COMMANDER]` | Real data |
| Technical incident lead | `[TECHNICAL LEAD]` | Real data |
| Customer communications lead | `[COMMUNICATIONS LEAD]` | Real data |
| External Kenyan privacy adviser | `[COUNSEL / ODPC ADVISER]` | Legal sign-off |
| Salon controller contact | `[SALON OWNER / PRIVACY CONTACT]` | Each pilot |
| Backup approver for production data changes | `[SECOND APPROVER]` | Real data |

No one person should approve and execute an emergency production-data change
when a second authorised reviewer is reasonably available.

## Control boundary

### Implemented software controls

The current pilot branch contains the following controls. They are evidence of
engineering work, not proof that a future deployment is compliant:

- Database access is server-side; recovery migration 004 enables row-level
  security and revokes direct PostgREST access for anonymous and authenticated
  roles.
- Owner and administrator operations are tenant- and role-scoped. Public staff
  output excludes staff email and phone fields.
- Booking creation uses database transactions, price snapshots, availability
  checks and collision protection.
- User-controlled text and URLs are validated or sanitised, Kenyan phone
  numbers are normalised, and database TLS verification is enforced.
- Authentication enforces bounded JWT algorithms, issuer and audience; the
  pilot branch moves browser sessions to role-specific HttpOnly, Secure and
  SameSite cookies and applies same-origin checks to cookie-authenticated
  mutations.
- The integration-test safety gate rejects unsafe database targets, and the
  recovery package contains backup/restore verification material.
- Rate-limit storage is designed to use one-way identifiers rather than store
  raw phone numbers in the limiting key.

Before relying on any item, rerun the relevant automated tests and verify the
actual Vercel, Supabase and provider configuration. A repository control can be
disabled or bypassed by a wrong deployment setting.

### Draft processes that still need owners and rehearsals

- The retention schedule and deletion/anonymisation job.
- The rights-request case register and controlled export/deletion tooling.
- The breach decision process and 72-hour tabletop exercise.
- The subprocessor and cross-border register.
- The salon DPA, data-import authorisation and staff training record.
- The synthetic demo reset and sign-off record.

### External decisions that block a real pilot

- Legal operator identity, privacy contact and support route.
- Controller/processor allocation and ODPC registration status for each role.
- Lawful basis and notice wording for each purpose, including direct marketing.
- Final retention periods, legal holds and accounting/tax records.
- Whether appointment notes are enabled and what content is prohibited.
- Subprocessor contracts, data locations, onward transfers and cross-border
  safeguards.
- Final salon agreement/DPA, customer terms and privacy notice.
- Any SMS, WhatsApp, analytics, monitoring or payment provider activation.
- The facts-and-risk decision on whether an incident is reportable.

## Kenya-focused data map

Maintain this map whenever a field, provider, export or purpose changes. The
data minimisation, notice and retention duties reflected here come from sections
25, 29 and 39 of the Data Protection Act and regulation 19 of the General
Regulations.

| Dataset and people | Minimum fields and purpose | Source and current system | Working role / disclosure | Minimisation rule or open action |
| --- | --- | --- | --- | --- |
| Public salon listing; salon owner/staff may be identifiable | Trading name, approved public phone, area/directions, category, description, hours, approved images and social links; discovery and booking | Salon-authorised input; PostgreSQL, server-rendered web pages | Salon decides listing; public disclosure | Publish only what the salon expressly marks public. Do not use a home address unless the owner deliberately operates there and approves publication. |
| Owner/admin account | Name, business email, business phone, password hash, role and session/security metadata; authentication and administration | Account holder; PostgreSQL and application runtime | Operator is likely controller | Never collect a password through an onboarding form. Do not collect national ID or KRA PIN in the app merely to create a login. |
| Customer account | Name, normalised phone, optional email, password hash; booking identity and account access | Customer; PostgreSQL | Salon controller for booking use; operator role needs legal confirmation for account/security use | Matching name or phone is not proof of account ownership. Never attach an old guest booking without verified control of the phone and an audited merge. |
| Guest customer and booking | Name, normalised phone, service, staff, date/time, price/promotion snapshot, status and short operational note; fulfil an appointment | Customer or salon; PostgreSQL | Salon controller, SalonBook processor is the pilot assumption | Make email optional. Do not request national ID, health history, biometrics, ethnicity or M-Pesa PIN. Disable or tightly constrain free-text notes until the salon approves a no-sensitive-data rule. |
| Staff profile and rota | Display name, role, image, service eligibility, working hours, breaks and blocked dates; staff selection and scheduling | Salon; PostgreSQL | Salon controller | Public output must not expose private email/phone. Confirm rights to publish names and images; allow a generic role label if a worker declines a public profile. |
| Promotion and price | Offer text, code, limits, validity, price/rate and booking linkage; quote and audit the price offered | Salon; PostgreSQL | Salon controller | Do not encode customer traits or sensitive categories in promo names. Retain the price snapshot, not hidden profiling data. |
| Review | Rating, review text, customer/business link and moderation state; feedback | Customer; PostgreSQL/public page if enabled | Role and publication basis require final terms | Warn against sensitive or defamatory content, provide moderation/removal route, and do not publish contact details. |
| Notification | Recipient phone, template variables, booking reference, provider ID, submission/delivery state and timestamps; transactional updates | Booking record; app and future provider | Salon controller; SalonBook and provider processors | Keep message content out of general logs. Do not treat provider acceptance as handset delivery. Booking contact must not become marketing consent. |
| Security/rate-limit record | One-way request key, timestamps, route, failure/error and minimal request metadata; abuse prevention and incident response | Application/runtime | Operator is likely controller | Never log passwords, session tokens, database URLs, full request bodies or full booking messages. Mask phone/email/IP where operationally possible. |
| Backup | Encrypted snapshot of in-scope database records; disaster recovery | PostgreSQL backup/export | Same roles as source data | Restrict access, encrypt in transit/at rest, log restores and ensure deleted records age out under the approved backup window. |
| Support, rights request and incident case | Case ID, requester verification result, correspondence, affected records, decisions and evidence; fulfil rights and demonstrate handling | Requester, salon, providers and system evidence; restricted operations register | Depends on case; operator controls its case record | Store separately from normal product analytics. Record that identity was verified, not excess identity documents. Redact exported evidence. |
| Operator/salon contract and billing | Legal/trading name, authorised signatory, business address, KRA/tax details only where required, invoices; contract and accounting | Salon/operator; approved finance/contract system, not booking notes | Each party controller for its legal records | **External decision:** tax/accounting adviser sets required fields and retention. Do not display legal identifiers publicly. |
| Payment | Not active | No production payment provider | Undecided | Do not collect card details, M-Pesa PINs or customer identity documents. A future provider should return only the minimum transaction reference, amount and status. |

### Collection and use rules

1. Ask whether a field is necessary for the stated booking or administration
   purpose before adding it. Convenience and possible future use are not a
   purpose.
2. Use a separate, affirmative choice for direct marketing. A booking phone
   number, service notification or acceptance of terms is not marketing
   consent. Honour a direct-marketing objection immediately and no later than
   the applicable statutory process.
3. Do not accept national identity numbers, full KRA PIN records, passwords,
   payment PINs, biometrics, health history or information about children in
   the first pilot. Escalate accidental collection to the privacy lead.
4. Treat free-text appointment notes as high risk. Permit only a brief service
   preference such as “short style”; never request medical/allergy details. If
   the product cannot enforce this, disable notes for the pilot and use the
   salon's approved off-platform safety process.
5. Redact screenshots, support recordings and error reports. Use booking IDs,
   not full phone numbers, when troubleshooting.
6. Keep public listing data separate from private owner, staff and customer
   data. A salon's authorisation to display its phone does not authorise display
   of a staff member's private phone.
7. Do not scrape or import an existing customer list. Import requires written
   salon instructions, source/lawful-basis confirmation, field mapping, sample
   review and a reversible rehearsal.

## Proposed retention schedule — pending legal approval

Every period below is a planning proposal, not an approved policy. Before real
data, `[PRIVACY LEAD]`, `[LEGAL OPERATOR]`, the salon controller and Kenyan
counsel must approve or replace each period and document the purpose, statutory
or contractual constraint, deletion method and owner. Regulations require a
retention schedule, periodic audit and action when the purpose lapses; they do
not make the proposals below automatically correct for SalonBook.

| Record | Proposed active period | End-of-period action | Approval / implementation gap |
| --- | --- | --- | --- |
| Unsubmitted booking or signup form | Browser session only; no server persistence | Clear on navigation/session end | Verify analytics and error tooling do not capture field values. |
| Business invitation | Raw token exists only in the administrator response/link and signup-page memory; database stores a SHA-256 digest | Link expires within 1–7 days; retain/review minimal invitation audit metadata under the approved account lifecycle | Never email or log the raw token; administrator must share it directly with the intended owner. |
| Owner/admin/customer account | Account or salon-contract life, then 90 days | Revoke sessions; delete or irreversibly anonymise unless a documented hold applies | Counsel and contract approval; automated account deletion is not complete. |
| Booking, cancellation/no-show and price snapshot | 24 months after appointment | Remove direct identifiers or delete; retain only non-identifying aggregate | Salon instruction, legal-claim and accounting review required. |
| Guest name, phone and email | 24 months after last appointment | Delete or pseudonymise; do not silently link to a later account | Automated lifecycle job is not complete. |
| Appointment free-text note | 90 days after appointment | Delete; do not carry forward | Prefer disabling for pilot. Confirm deletion does not alter required booking history. |
| Review | While published and purpose remains, then 30 days after removal/account closure | Delete or anonymise after complaint/legal-hold review | Terms, moderation and erasure handling require approval. |
| Session cookie | Current configured session lifetime (target no more than 7 days) | Expire/revoke | Verify deployed cookie and token configuration; add server-side revocation. |
| Rate-limit key | Configured abuse-control window, with a target maximum of 24 hours | Automatic expiry | Verify actual store TTL and that key is one-way. |
| Notification content/payload | Target 30 days; store less where possible | Delete content, retaining minimal delivery fact if needed | Depends on provider and future outbox design. |
| Notification delivery fact/provider ID | 90 days | Delete or aggregate | Provider contract and complaint window approval required. |
| Application/security logs | 90 days | Delete or aggregate | Incident needs may justify a separately approved restricted hold. Configure every platform/provider. |
| Support and data-rights case | 24 months after closure | Delete or minimise; retain outcome-only evidence if justified | Counsel approval; restricted register required. |
| Incident record | Proposed 5 years after closure | Secure deletion after legal-hold review | Counsel must set the period; never put raw leaked datasets in the incident register. |
| Database backup | Rolling 30 days | Cryptographic/managed expiry; document that normal deletion ages out through backups | Confirm Supabase tier, region, retention and restore evidence. |
| Synthetic demo data | Same day; no later than 24 hours after demo | Reset to approved baseline and verify | Draft reset SOP below; assign an operator. |
| Contract, invoice and operator tax record | Period set by Kenyan tax/accounting advice | Restricted archive then secure deletion | External legal/accounting decision; keep outside appointment notes. |

Run a quarterly retention audit during the pilot. The reviewer records counts by
record class, oldest date, exceptions, deletion result and proof of backup
expiry. A legal hold must name its authoriser, scope, reason, review date and
release date. It must not become indefinite retention by default.

## Data-subject request SOP

Sections 26, 38–40 of the Act and regulations 8–12 of the General Regulations
cover access, objection, correction, portability and erasure. The operational
targets below use the shortest applicable statutory period; counsel must confirm
the calculation for each case.

| Request | Operational deadline from receipt | Key regulation |
| --- | --- | --- |
| Access | 7 calendar days, free | General Regulations reg. 9 |
| Rectification | Complete within 14 days; refusal notice within 7 days, free | reg. 10 |
| Objection | Respond within 14 days, free; stop direct marketing on objection | reg. 8 |
| Erasure | Respond within 14 days, free | reg. 12 |
| Portability | Within 30 days in a structured, commonly used machine-readable format; reasonable cost only where lawful | reg. 11 and Act s. 38 |

### 1. Intake and preserve

1. Accept a request through `[PRIVACY EMAIL / FORM]`; do not force the person
   to contact a salon in public social media.
2. Open `DSR-YYYY-NNN`, record receipt time in Africa/Nairobi time, requested
   rights, affected salon, channels, deadline and owner. Acknowledge within one
   business day without promising the outcome.
3. Preserve the records in scope and suspend conflicting routine deletion while
   the request is assessed. Do not make an unreviewed production query or edit.
4. Decide whether SalonBook is acting as controller or processor for the data.
   For salon-controlled data, forward the verified request to the named salon
   contact under a proposed 24-hour contractual SLA and assist on written
   instructions. Continue tracking the statutory deadline.

### 2. Verify identity proportionately

- **Logged-in account:** require a valid session plus reauthentication or a
  one-time code to the already verified channel when available.
- **Guest booking:** require the booking reference plus control of the original
  normalised phone through an OTP or a controlled callback. Name and phone text
  alone are not proof. Do not disclose that unrelated bookings exist.
- **Salon staff/owner:** use the verified owner account or approved business
  email and check the onboarding authorisation matrix.
- **Authorised agent:** verify the data subject and written authority; retain a
  minimal verification record and delete unnecessary document copies.
- Never redirect an export to a newly supplied email or phone until control of
  the original channel and the change are independently verified.
- Do not demand a national ID where lower-risk evidence is sufficient. The
  privacy lead must approve any exceptional ID collection and record why.

If verification fails, pause disclosure, explain the minimum missing proof and
keep the case open. Do not deny a request merely because the first channel was
inconvenient.

### 3. Locate, review and fulfil

1. Search every applicable row in the data map: account, guest identity,
   bookings, notes, reviews, notifications, support, logs, providers and
   recoverable backups. Record queries and reviewers without copying the whole
   dataset into the case system.
2. Have a second authorised person review the match and redact other people's
   data, secrets, internal abuse controls and legally privileged material.
3. For access, explain purposes, data categories, recipients, retention/source
   and safeguards as applicable. Deliver through an authenticated download or
   other verified secure channel.
4. For portability, use UTF-8 CSV or JSON with a short field dictionary. Do not
   substitute a screenshot or PDF for machine-readable records; a human-readable
   summary may accompany them.
5. For correction, update the canonical identity/contact fields and downstream
   processors, then notify third parties where legally required and reasonably
   practicable. Preserve a booking's historical service/price truth through an
   audited correction, rather than silently rewriting commercial history.
6. For objection or restriction, stop the disputed processing while assessed.
   Suppression needed to honour a marketing opt-out should contain only the
   minimum one-way/contact marker and a recorded purpose.
7. For erasure, document each deleted, anonymised, restricted or retained item
   and the legal reason. Revoke sessions and notify relevant processors/third
   parties. Normal backups may age out under the approved rolling window but
   must not be restored into active use without replaying deletions.
8. Send the outcome, completion date, any refusal/exception and the ODPC
   complaint route. Close only after delivery is confirmed and the case register
   is complete.

**Current gap:** SalonBook does not yet provide a complete self-service export,
correction, restriction or deletion workflow. Until reviewed tooling exists,
fulfilment is a controlled two-person operation with a fresh backup, read-only
discovery first, explicit salon/controller instruction and a documented rollback
plan. This runbook never authorises an ad hoc production mutation.

## Security incident and personal-data breach runbook

Section 43 of the Act creates a conditional controller notification deadline of
no later than 72 hours after awareness where unauthorised access or acquisition
creates a real risk of harm. A processor must notify its controller without
delay and, where reasonably practicable, within 48 hours. The facts, effects and
remedial action must be recorded even when the decision is not to notify.

The timer begins at the first defensible point SalonBook or the responsible
controller is aware of a potential breach—not when every fact is known. Record
that timestamp and time zone. The privacy lead/counsel decides reportability;
the incident commander cannot simply restart the clock.

### Response clock

| Elapsed from awareness | Owner | Required action |
| --- | --- | --- |
| 0–15 minutes | Discoverer / on-call | Create incident ID; record awareness time, reporter and facts; page `[INCIDENT COMMANDER]` and `[PRIVACY LEAD]`; keep personal data out of chat/tickets. |
| 0–1 hour | Technical lead | Contain without destroying evidence: revoke exposed tokens, isolate the affected feature/account, block abusive access and preserve relevant logs/configuration. Stop risky deploys. |
| 1–4 hours | Incident team | Identify systems, salons, processors, countries, data categories, approximate people/records, access/acquisition evidence and ongoing risk. Confirm whether SalonBook is controller or processor for each set. |
| 4–24 hours | Privacy lead + counsel | Assess likely harms, protections such as effective encryption, affected vulnerable people, misuse likelihood and actions subjects can take. Draft controller, ODPC and subject notices in parallel. |
| By 24 hours | Incident commander | Give every affected salon/controller an initial factual update and next update time, even if the formal processor threshold is still being assessed. |
| By 48 hours | Privacy lead | When acting as processor, notify the relevant controller without delay and within the statutory practicability window; provide known facts and follow with phased updates. |
| By 60 hours | Legal operator + privacy lead | Sign a written `notify / do not notify / insufficient facts—escalate` decision for ODPC and for affected people. Record statutory threshold, evidence and reasons. |
| By 72 hours | Controller / authorised filer | If the statutory threshold is met, submit through the ODPC breach channel. If late, explain the delay. Do not wait for perfect counts; phase additional information. |
| As reasonably practical | Communications lead | Where required, notify affected people in writing, in clear language and through an effective channel. Give protective steps and a monitored contact. |
| After containment | Incident team | Eradicate root cause, rotate credentials, validate restore/tenant boundaries, monitor abuse, reconcile all notices, run a retrospective and track remediation to closure. |

Use the official [ODPC report-a-data-breach
portal](https://www.odpc.go.ke/report-a-data-breach/) for a report. The incident
record and draft should cover:

- nature, discovery/awareness time and likely cause;
- controller/processor identity and all affected salon controllers;
- data and people categories, approximate counts and affected systems;
- actual/likely effects and the “real risk of harm” assessment;
- unauthorised person where known and lawful to identify;
- containment, short/medium/long-term remediation and safeguards already in
  place;
- whether and how affected people were contacted, recommended protective steps
  and the privacy contact;
- processor/controller/subprocessor notices and their timestamps; and
- reasons for delay, non-notification or phased information.

Do not copy the exposed dataset into the incident log. Preserve immutable
evidence with access logging, hashes where appropriate and a clear custodian.
Public statements require `[COMMUNICATIONS LEAD]`, `[PRIVACY LEAD]` and
`[LEGAL OPERATOR]` approval, but internal containment never waits for public
wording.

### Tabletop acceptance test

Before real data, run a synthetic tenant-isolation or leaked-token scenario.
Pass only if the team can identify the 0-hour timestamp, call tree, affected
controller, data map, 48/60/72-hour decisions, ODPC draft fields, data-subject
draft, evidence location and remediation owner without using real personal data.

## Subprocessor and cross-border gate

The recovered architecture indicates a Vercel application and a Supabase
PostgreSQL project reported in `eu-west-1`. That suggests processing outside
Kenya, but the operator must verify the actual project, backups, support access,
logs and every provider's current terms. GitHub should contain source and
synthetic fixtures only; it becomes an in-scope processor if real personal data
is placed in issues, CI artefacts or logs.

Sections 48–49 of the Act and regulations 40–48 require a documented transfer
basis and safeguards. Sensitive personal data transferred outside Kenya has an
additional statutory consent/safeguards condition. The first pilot should avoid
sensitive data rather than rely on consent to repair an unnecessary collection.

### Provider register template

Complete one row and attach evidence before enabling each provider.

| Provider / service | Purpose and exact fields | Storage and support-access countries | Contract/DPA and confidentiality | Security, deletion/return and breach SLA | Subprocessors/onward transfers | Controller authorisation and transfer basis | Owner / last review / status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Supabase / database and backup | `[COMPLETE]` | Verify `eu-west-1`, backup and support locations | `[ATTACH]` | `[ATTACH]` | `[LIST/LINK]` | `[LEGAL REVIEW]` | `[OWNER / DATE / BLOCKED]` |
| Vercel / hosting, runtime and logs | `[COMPLETE]` | `[VERIFY]` | `[ATTACH]` | `[ATTACH]` | `[LIST/LINK]` | `[LEGAL REVIEW]` | `[OWNER / DATE / BLOCKED]` |
| GitHub / source and CI | No production personal data intended | `[VERIFY]` | `[ATTACH IF IN SCOPE]` | Prohibit secrets/PII in issues and artefacts | `[VERIFY]` | `[ASSESS]` | `[OWNER / DATE]` |
| SMS provider | Disabled until approved; proposed phone + minimal booking template | `[VERIFY]` | `[ATTACH]` | Delivery evidence, deletion, incident notice target ≤24h | `[VERIFY]` | Salon prior authorisation + transfer review | `[OWNER / BLOCKED]` |
| Monitoring/analytics | Disabled or strictly no-PII until approved | `[VERIFY]` | `[ATTACH]` | Field allowlist, masking, retention and access | `[VERIFY]` | `[LEGAL REVIEW]` | `[OWNER / BLOCKED]` |
| Future payment provider | Not active | `[VERIFY]` | `[ATTACH]` | Tokenised/minimum transaction data; no PIN/card capture | `[VERIFY]` | Separate payment/legal review | `[OWNER / BLOCKED]` |

For each row, the gate owner must:

1. Map exact fields and purpose; reject broad “all app data” descriptions.
2. Confirm controller/processor status and sign a written contract covering
   instructions, confidentiality, security, rights assistance, incidents,
   deletion/return and audit evidence.
3. Obtain the salon controller's prior general or specific authorisation for
   subprocessors and define change notice/objection handling. A processor may
   not silently add another processor.
4. List primary storage, backup, disaster-recovery and remote support countries,
   plus onward subprocessors.
5. Select and document the Kenyan transfer condition/safeguard with counsel;
   perform a transfer risk assessment and make notice wording consistent.
6. Verify access controls, MFA, encryption, log redaction, tenant separation,
   recovery, deletion and an incident-notification SLA that leaves SalonBook
   time to meet its 48/72-hour obligations.
7. Test export and deletion/return at termination. Marketing claims and a
   provider's generic privacy page are not a substitute for contractual evidence.

No new provider receives real data until every applicable cell is complete and
the privacy lead records a go decision.

## Salon DPA and onboarding authorisation

Regulations require the controller–processor contract to state the subject,
duration, nature, purpose, data types, data-subject categories and controller
instructions, and to address confidentiality, security, deletion/return and
inspection. Use the following signing checklist; the actual contract requires
legal review.

### Contract/DPA checklist

- [ ] Correct legal names, registration details, addresses, authorised
      signatories and notices contacts.
- [ ] Controller/processor role for each purpose, with no blanket claim that one
      role covers every platform activity.
- [ ] Subject matter, duration, processing nature/purpose, personal-data types
      and subject categories.
- [ ] Documented salon instructions and a change-control method.
- [ ] Confidentiality commitments and staff access/training controls.
- [ ] Technical and organisational security schedule, backup responsibility and
      tenant-separation commitments.
- [ ] Processor incident notice path and contractual target that supports the
      statutory 48/72-hour clocks.
- [ ] Rights-request assistance, verification responsibilities, deadlines and
      cost boundaries.
- [ ] Approved subprocessor list, prior authorisation, change notice/objection,
      onward-transfer obligations and processor responsibility.
- [ ] Countries, cross-border basis/safeguards and access by remote support.
- [ ] Retention schedule, legal holds, termination export, deletion/return and
      backup ageing.
- [ ] Audit/inspection evidence, confidentiality limits and remediation.
- [ ] Ownership/accuracy of salon content, prohibited sensitive content,
      support, suspension, termination and liability allocation.

### Onboarding authorisation record

- [ ] Legal and trading name; authorised owner/signatory; privacy and backup
      contacts verified outside a public chat.
- [ ] Written authority to publish the exact business name, phone, location,
      directions, hours, images, staff names/images and social links.
- [ ] Rights/licences for every logo and image.
- [ ] Staff have been told what profile/rota data is used; private phones/emails
      are not published.
- [ ] Services, prices, durations, buffers, hours, blocked dates and staff/service
      eligibility reviewed in the private preview.
- [ ] Cancellation, lateness, no-show, rescheduling and refund/deposit policies
      approved in customer-facing language.
- [ ] Customer notice and direct-marketing choice approved; transactional
      booking contact is not reused for marketing.
- [ ] No health, biometric, child, national-ID, password or payment-PIN data in
      the pilot; appointment-note rule accepted.
- [ ] Any data import has a signed instruction, source and lawful-basis statement,
      field map, sample approval and rollback/rejection plan. No scraped list.
- [ ] Subprocessor and international-transfer schedule supplied and authorised.
- [ ] Retention schedule, rights contacts, incident contacts and termination
      export/delete process accepted.
- [ ] Owner and backup user trained with individual accounts; no shared
      production password.
- [ ] Salon signs the final preview and a synthetic end-to-end rehearsal before
      activation. Record approver, date, build and evidence link.

## Synthetic demo reset SOP

This procedure is safe for sales demonstrations. It is not a production cleanup
procedure.

### Before the demo

1. Use a separate local or staging database and provider sandbox. Confirm the
   environment name in the UI and run the repository's integration safety gate.
   No production connection string may be present in the demo environment.
2. Seed a business visibly named `DEMO — Amani Studio` and only invented
   services, staff, customers, bookings, reviews and promotions. Use fictional
   images with publication rights.
3. Use email under a domain controlled for testing and a team-controlled test
   phone. Never assume a plausible `+254` number is unassigned. If provider
   delivery is not being demonstrated, keep messaging disabled and use an
   obvious non-routable placeholder accepted only by the local mock.
4. Set a unique demo password, do not share an owner production account and
   confirm M-Pesa/WhatsApp/real SMS integrations are disabled unless their
   sandboxes are deliberately part of the script.
5. Record the expected baseline counts for customers, bookings, reviews,
   notifications and users. Run the booking flow once and confirm that only the
   demo tenant changes.

### During the demo

- Tell attendees the data is synthetic and the environment is not the live
  salon service.
- Do not enter an attendee's name, phone, business customer list, credentials,
  live API key or screenshots of their existing system.
- If an attendee wants a tailored example, invent it together or schedule a
  separately authorised onboarding session.
- Do not send a test message to a person's phone without explicit agreement and
  an approved provider sandbox process.

### Reset immediately after the demo

1. End all browser sessions and revoke/rotate the shared demo credential.
2. Use the approved staging reset script or restore the known synthetic baseline.
   The operator confirms the environment twice; a second person approves any
   command capable of changing a database. Never adapt this SOP into an ad hoc
   production delete.
3. Remove newly created demo customers, guest rows, bookings, notes, reviews,
   promos, notification/outbox events and uploaded files. Reset schedules and
   counters to the documented baseline.
4. Purge provider-sandbox messages/logs where supported and confirm no real
   recipient was contacted.
5. Re-run baseline count and tenant-isolation checks. Save only aggregate demo
   metrics with no attendee identifiers.
6. Record `date/time, operator, environment, demo build, baseline/result,
   provider status, exceptions and reviewer` in the demo register. Finish within
   24 hours even if the same-day reset is interrupted.

If real personal data is accidentally entered, stop the reset, restrict access
and open a privacy/incident case. Record the event and obtain the privacy lead's
deletion instruction; silently erasing it would also erase the decision trail.

## Go/no-go evidence

### Guided synthetic demonstration

- [ ] Isolated demo environment and synthetic seed visibly identified.
- [ ] Production/provider credentials absent; integrations disabled or sandboxed.
- [ ] Baseline/reset operator assigned and reset evidence completed.
- [ ] No attendee or recovered production personal data used.
- [ ] Known inactive capabilities stated accurately during the demo.

### First real-business pilot

- [ ] Every named role and private contact is filled.
- [ ] Kenyan counsel records the role, lawful-basis and ODPC registration
      decisions; final notice, terms, salon agreement and DPA are signed.
- [ ] Retention table is approved and technically enforced or has a controlled
      manual procedure with evidence.
- [ ] Subprocessor/cross-border register is complete for the deployed services.
- [ ] Rights-request dry run produces a correct, redacted machine-readable export
      and rehearses correction, restriction and deletion without cross-tenant
      access.
- [ ] Incident tabletop passes the 48/60/72-hour decisions and call tree.
- [ ] Current backup restore, tenant isolation, authentication, rate-limit and
      complete booking-flow tests pass against the release candidate.
- [ ] Salon onboarding authorisation and private-preview sign-off are attached.
- [ ] One verified transactional customer-and-owner notification path works, or
      the pilot contract and UI explicitly use an agreed manual fallback.

If any real-pilot item is unchecked, remain in guided synthetic-demo mode.

## Primary Kenya sources

Official sources accessed 2026-08-12. Recheck the current versions before a
pilot or policy approval.

- [Data Protection Act, 2019 (Kenya Law, Cap. 411C; version dated
  2022-12-31)](https://new.kenyalaw.org/akn/ke/act/2019/24/eng@2022-12-31)
  — especially sections 25–26, 29, 38–43 and 48–49.
- [Data Protection (General) Regulations, 2021 (Kenya
  Law)](https://new.kenyalaw.org/akn/ke/act/ln/2021/263/eng@2022-12-31) —
  especially regulations 8–12, 19, 23–25, 32 and 40–48.
- [Data Protection (Registration of Data Controllers and Data Processors)
  Regulations, 2021 (Kenya
  Law)](https://new.kenyalaw.org/akn/ke/act/ln/2021/265/eng@2022-12-31).
- [ODPC: report a data breach](https://www.odpc.go.ke/report-a-data-breach/).
- [ODPC: registration FAQ](https://www.odpc.go.ke/faqs/).
- [ODPC: registration portal](https://dataportal.odpc.go.ke/Account/Register).
- [ODPC: assessment evidence themes](https://www.odpc.go.ke/assessments/).

The sources support the duties and deadlines described here; they do not decide
SalonBook's facts, role allocation, registration status, lawful bases, transfer
safeguards or final retention periods. Those remain recorded external decisions.
