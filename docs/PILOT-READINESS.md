# SalonBook Kenya pilot readiness

Last reviewed: 2026-08-12

## Current decision

- **Guided demonstration:** ready with a synthetic, active demo business.
- **Unattended real-customer pilot:** not ready until every gate below is
  checked and evidenced.
- **M-Pesa deposits:** not ready; the application deliberately rejects enabling
  deposits until a verified payment implementation exists.

The initial commercial wedge is a single-location, appointment-led Nairobi
salon, spa, nail studio, braider or premium barber with roughly 2–8 staff and an
existing Instagram/WhatsApp customer flow. Avoid medical-aesthetics businesses,
large chains and walk-in-heavy operations during the first pilot.

## Demonstration checklist

- [ ] Use only synthetic people and a clearly named Demo Studio.
- [ ] Show listing setup, private preview, admin activation, booking, owner
      refresh, cancellation rules, promotion and reporting.
- [ ] State that SMS is disabled unless Africa's Talking is configured; even an
      `accepted` SMS is not proven delivered until delivery receipts exist.
- [ ] State that M-Pesa, WhatsApp, online rescheduling, password recovery and
      claiming old guest bookings are not active.
- [ ] Reset the demo schedule after each sales session.

## Required before one real-business pilot

### Operator and legal

- [ ] Registered operator name, address, KRA PIN, support email and privacy
      contact supplied.
- [ ] Privacy Notice, Booking Terms, salon agreement and controller–processor
      agreement reviewed for the actual operator.
- [ ] ODPC controller/processor registration requirement confirmed.
- [ ] Supabase `eu-west-1` cross-border transfer safeguard documented.
- [ ] Retention, export, correction, deletion and incident-response procedures
      written; responsible person named.
- [ ] Salon has authorized every public name, phone, location, image and link.

### Reliability and security

- [ ] Supabase project cannot pause for inactivity and has recurring backups,
      or encrypted off-site dumps run automatically.
- [ ] A restore from the current backup mechanism has passed.
- [ ] Separate staging and production databases, provider accounts and secrets.
- [ ] MFA enabled on GitHub, Supabase, Vercel and provider accounts.
- [ ] Uptime and server-error monitoring configured with alerts and no PII in
      event payloads.
- [ ] Migrations 001–008 applied through a direct/session `5432` connection and
      every checksum verified.
- [ ] Vercel WAF rules configured and application rate-limit 429s monitored.
- [ ] Scheduled cleanup and size alerts configured for expired
      `rate_limit_windows` rows; request-path cleanup is only a bounded fallback.
- [x] Browser sessions use role-specific HttpOnly/Secure/SameSite cookies and
      cookie-authenticated mutations enforce same-origin intent.
- [x] Business onboarding is invitation-only: an administrator creates an
      email-bound, expiring, one-time link; only its digest is stored and signup
      consumes it atomically with the pending account.
- [ ] Add password reset, session rotation/revocation and owner/admin MFA before
      broad public operation.

### Booking operations

- [ ] Business listing readiness is 5/5 and an administrator has reviewed the
      private preview before activation.
- [ ] Owner and backup contact know how to refresh the booking desk and how to
      respond if the provider is unavailable.
- [ ] One real transactional channel works for both customer and owner
      notifications (creation, owner-alert and cancellation SMS intents are
      wired, but credentials and handset delivery verification are external
      gates).
- [ ] The paid-plan five-minute worker, strong `CRON_SECRET`, outbox/retry and
      provider delivery receipts are operating and monitored.
- [ ] Cancellation, late-arrival, no-show and change policies are approved and
      shown to customers.
- [ ] A support route exists for rescheduling, because online rescheduling is
      not implemented.
- [ ] Salon data export has been rehearsed before the pilot agreement is signed.

## Required before M-Pesa deposits

- [ ] Decide direct-per-salon Safaricom Till/Paybill or contract with a licensed
      PSP; obtain Kenya payment-law advice before SalonBook holds or redistributes
      any funds.
- [ ] Complete Daraja sandbox and production onboarding without sharing secrets
      in chat, source code or email.
- [ ] Implement payment states: initiated, pending, paid, failed, cancelled,
      reversed and refunded.
- [ ] Validate booking, business, amount and merchant on every idempotent callback.
- [ ] Add status-query recovery, payment timeout, daily reconciliation and an
      auditable refund/reversal workflow.
- [ ] Publish deposit, cancellation and refund terms before collection.
- [ ] Confirm the eTIMS boundary with a Kenyan tax practitioner. Each salon
      remains responsible for its customer invoice; SalonBook is responsible for
      compliant invoices for its own SaaS fees.

## Pilot onboarding record

Collect only what is needed:

- Legal/trading name and authorized owner contact.
- Public phone, WhatsApp, email, exact location/directions and social links.
- Logo/images plus rights-to-publish confirmation.
- Services, prices, durations, buffers, staff/service eligibility and schedules.
- Hours, holidays, blocked dates and cancellation/no-show rules.
- Signed terms/DPA and existing-data import authorization.

Never request a password, M-Pesa PIN, full identity number or sensitive customer
health information through this form.

## Pilot exit criteria

Do not call SalonBook broadly production-ready until three real businesses have
completed about four weeks each with at least 30 bookings per business, no
double-booking or tenant-isolation incident, a tested backup restore, no open
critical defect, at least 95% successful transactional-notification delivery,
100% payment reconciliation if deposits are enabled, and at least two businesses
willing to continue at the tested price.

Planning hypothesis to validate, not published pricing: 30-day guided pilot at
no charge for weekly feedback; Booking Lite around KES 1,500–2,500 per branch
per month; reminders/deposits around KES 2,999–4,500 plus messaging usage.
