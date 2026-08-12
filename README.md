# SalonBook – Appointment & Booking Platform

Professional appointment booking platform for salons and barber shops in Kenya. Business owners manage their services, working hours, and bookings. Customers book appointments online — no account required.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL
- **Auth:** signed JWT sessions in role-specific HttpOnly cookies, with bcrypt password hashing

## Project Structure

```
src/
├── app/
│   ├── api/                  # API routes
│   │   ├── auth/             # Signup, login, me
│   │   ├── businesses/[id]/  # Services, bookings, customers, slots, working-hours
│   │   └── bookings/         # Public booking creation + business lookup
│   ├── auth/                 # Login & signup pages
│   ├── book/[slug]/          # Public booking flow (Calendly-style)
│   ├── dashboard/            # Owner dashboard (protected)
│   │   ├── bookings/
│   │   ├── services/
│   │   ├── customers/
│   │   └── settings/
│   └── page.tsx              # Landing page
├── components/
│   ├── ui/                   # Reusable UI: Button, Input, Card, Badge, Modal
│   ├── dashboard/            # Sidebar
│   ├── booking/              # (extensible)
│   └── landing/              # (extensible)
├── lib/
│   ├── db/                   # Pool, schema, migration
│   ├── services/             # Business logic: booking, business, service
│   ├── modules/              # External integration boundaries
│   │   ├── sms/              # Africa's Talking SMS (credential-gated)
│   │   ├── mpesa/            # Safaricom M-Pesa (Daraja)
│   │   ├── whatsapp/         # WhatsApp Cloud API
│   │   └── stripe/           # Stripe subscription billing
│   ├── auth.ts               # JWT + bcrypt helpers
│   ├── auth-context.tsx      # React auth provider
│   ├── api-client.ts         # Typed fetch wrapper
│   └── validation.ts         # Input validation & sanitization
└── types/
    └── index.ts              # TypeScript interfaces
```

## Setup

### Prerequisites

- Node.js 20.9–24
- PostgreSQL 17 recommended (14+ supported by the application)

### Installation

```bash
git clone <repo-url>
cd salonbook
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Configuration variables:

| Variable                 | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`           | Runtime PostgreSQL connection string                   |
| `MIGRATION_DATABASE_URL` | Recommended direct/session URL for migrations (port 5432) |
| `SUPABASE_DB_CA_CERT`    | Supabase production CA certificate for strict TLS      |
| `JWT_SECRET`             | Secret key for JWT signing (32+ chars)                 |
| `RATE_LIMIT_HMAC_SECRET` | Separate 32+ byte HMAC key for private rate-limit identifiers |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL used for metadata and links           |
| `NEXT_PUBLIC_LEGAL_NAME` | Registered operator name for legal notices                |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Published customer and business support address        |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | Published privacy and data-rights address               |
| `SMS_NOTIFICATIONS_ENABLED` | Explicit SMS send gate; must be exactly `true`      |
| `AFRICASTALKING_ENVIRONMENT` | `sandbox` or `production`                           |
| `AFRICASTALKING_API_KEY` | Server-only Africa's Talking app API key                |
| `AFRICASTALKING_USERNAME` | App username (`sandbox` in the test environment)       |
| `AFRICASTALKING_SENDER_ID` | Approved Sender ID; required in production            |
| `AFRICASTALKING_TIMEOUT_MS` | Optional request timeout from 1000-10000 ms           |
| `CRON_SECRET`             | Strong 32+ byte secret for the internal outbox worker   |

### Database Setup

Run the migration to create tables:

```bash
npm run db:migrate
```

For Supabase, set `MIGRATION_DATABASE_URL` to the direct connection or the
Supavisor **Session** connection on port `5432`. Keep the port `6543`
transaction-pooler URL in `DATABASE_URL` for serverless runtime traffic; the
migration runner refuses it because migrations use a session advisory lock.
Download the public CA certificate from Supabase's Database Settings → SSL
Configuration and store its full PEM text in `SUPABASE_DB_CA_CERT`. Runtime and
migration connections fail closed if a Supabase URL is configured without it.

### Transactional SMS

SMS notifications are off by default and are recorded as `disabled`, not sent.
To test safely, create an Africa's Talking app, use its sandbox API key, keep
`AFRICASTALKING_ENVIRONMENT=sandbox` and `AFRICASTALKING_USERNAME=sandbox`, then
set `SMS_NOTIFICATIONS_ENABLED=true`. For production, register a Kenyan Sender
ID (11 characters maximum), set the production app credentials and the exact
approved ID, then change the environment to `production`. The integration uses
a fixed provider endpoint, validates Kenyan numbers as E.164, has a bounded
timeout, and stores only provider status plus the provider message ID in the
notification payload.

An `accepted` notification means Africa's Talking accepted the API submission;
it does not prove handset delivery. Provider setup is documented in the
[official SMS guide](https://help.africastalking.com/en/articles/2258472-how-do-i-start-sending-messages)
and [official Node SDK](https://github.com/AfricasTalkingLtd/africastalking-node.js).

Booking confirmations, owner alerts and cancellation notices use
`notification_outbox`. The two creation intents are inserted in the same
PostgreSQL transaction as the booking; the cancellation intent is inserted in
the first atomic `Booked` → `Cancelled` transition. The queue does not copy
phone numbers, customer names or message text. A protected worker claims at
most 10 ready rows with `FOR UPDATE SKIP LOCKED`, commits the lease before
calling the provider, then retries transient failures with bounded backoff and
dead-letters exhausted jobs or jobs older than two hours. Creation alerts are
invalidated if the booking leaves `Booked` before dispatch. Terminal booking
states cannot be reopened or changed to another terminal state, and repeating
the same terminal state does not create another cancellation notice.

`vercel.json` calls `/api/internal/notifications/dispatch` every five minutes.
Set a random 32+ byte `CRON_SECRET` in Vercel; Vercel sends it as
`Authorization: Bearer`. The intended five-minute schedule requires a paid
Vercel plan: Hobby cron jobs can run only once per day and therefore cannot meet
booking-alert latency. Do not enable SMS for a real pilot until this recurring
worker and provider sandbox are observed end-to-end. Vercel does not retry a
failed cron invocation; durable pending rows remain for the next run. See
Vercel's official [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
and [security/error-handling guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

The outbox is at-least-once, not exactly-once. A crash after Africa's Talking
accepts a submission but before the database records `accepted` can cause a
duplicate SMS when the two-minute lease expires. Provider delivery receipts and
deduplication beyond provider message IDs remain future work.

For production, take and verify a database backup first, then run migrations
before deploying application code that reads the new columns. Migration 004
installs a narrowly scoped compatibility trigger, so legacy application
instances can continue inserting bookings while the new deployment rolls out.
New writers that supply snapshot prices are not modified. Keep the trigger
until every legacy instance has drained; remove it later with a new forward-only
migration after production booking smoke tests pass.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
TEST_DATABASE_URL=postgresql:///salonbook_test_local npm run test:integration
npm run build
npm run test:e2e:firefox
```

Integration tests refuse remote database hosts and require the database name to
contain `salonbook_test`. Browser tests use deterministic API fixtures and never
connect to production data. See [the 2026-08-11 recovery record](docs/RECOVERY-2026-08-11.md)
for the verified backup, counts, schema reconciliation, and rollout order.

Authentication, signup, and public booking writes use PostgreSQL-backed fixed
windows so limits remain consistent across Vercel instances. Only keyed HMAC
digests reach `rate_limit_windows`; raw IP addresses, emails, and phone numbers
are never stored there. Production Vercel requests use the platform-managed
`x-vercel-forwarded-for` address. Non-Vercel production hosting needs an audited
trusted-proxy adapter before these protected routes can be enabled safely.
Business and customer logins allow 10 attempts per 15 minutes for one
network/email pair, admin login allows 5 per pair, and signups allow 5 per hour
for one network/identity pair. Higher shared-network ceilings and, where useful,
distributed-principal ceilings reduce carrier-NAT collisions without permitting
unbounded row growth. Invitation-only business signup deliberately has no
global email/phone-only lockout because its 256-bit capability is the authority.
Public booking allows 10 per network/phone pair and 100 per shared network per
10 minutes; it deliberately has no global phone-only lockout. Exhaustion returns
`429` with `Retry-After`; limiter failures return `503` before authentication or
booking mutation. Expired counters are removed in bounded batches during normal
traffic; production operations must also schedule indexed expiry cleanup and
alert on table growth before broad public traffic.

Browser sessions are stored in role-specific `HttpOnly`, `SameSite=Lax`
cookies (`Secure` in production), never returned in login/signup JSON and never
read by application JavaScript. Cookie-authenticated mutation routes also
require a matching same-origin `Origin` header. Legacy bearer authentication is
accepted temporarily for controlled rollout compatibility; remove it with a
forward-only release after old clients have drained. Sessions are still signed
JWTs rather than a server-side revocable session store, so password-reset,
rotation/revocation and MFA remain pre-scale work.

## User Flows

### Business Owner

1. Receive a one-time, email-bound pilot invitation from an administrator
2. Open its `/auth/signup` link and create the pending business account
3. Add services from the dashboard
4. Configure working hours in Settings
5. Complete the listing-readiness checklist and private preview
6. Ask an administrator to activate the listing
7. Share the booking link: `/book/[your-slug]`
8. View and manage bookings from the dashboard

### Customer (No Account Required)

1. Visit the booking link: `/book/[business-slug]`
2. Select a service
3. Pick a date and available time slot
4. Enter name and phone number
5. Confirm booking

The confirmation shows a booking reference and the business phone number.
Guest bookings are deliberately not attached to a later account by matching
only a name or phone number; secure phone-verification linking is future work.

## Pilot boundary

The current code is suitable for controlled demonstrations and, after the
external readiness gates below, a narrowly supervised booking-only pilot. Do
not advertise M-Pesa deposits, WhatsApp messaging, subscription billing,
online rescheduling, password recovery, or guest-booking claiming as active.

Before real customer data is accepted:

1. Configure the legal operator name, support address and privacy address.
2. Have Kenya-specific privacy/terms and the salon data-processing agreement
   reviewed; document the Supabase EU transfer safeguard and retention period.
3. Apply every migration to a staging database, then production only after a
   verified backup. Keep staging/test credentials separate from production.
4. Upgrade Supabase for recurring backups or automate encrypted off-site dumps,
   and prove a restore. Enable MFA and production monitoring/alerts.
5. Configure Vercel Firewall rules for additional edge protection, especially
   public slot/promotion reads, and monitor the application rate-limit table.
6. Connect Africa's Talking in sandbox, provision the paid-plan recurring
   worker and validate retries. Add delivery receipts before claiming handset
   delivery for customer and owner SMS submissions.
7. Use a synthetic demo business and obtain explicit authorization before any
   real salon profile is published.

Deposits are a separate release gate. Use each salon's own Safaricom Till or
Paybill (or a licensed PSP) so settlement is direct; add an idempotent payment
ledger, callbacks, reconciliation and refund rules before enabling any payment
flag. The application must never collect an M-Pesa PIN.

## API Routes

| Method | Route                                          | Auth     | Description              |
| ------ | ---------------------------------------------- | -------- | ------------------------ |
| POST   | `/api/auth/signup`                             | Invite   | Redeem a one-time business invitation |
| POST   | `/api/auth/login`                              | Public   | Login                    |
| GET    | `/api/auth/me`                                 | Required | Get profile + stats      |
| POST   | `/api/admin/business-invitations`              | Admin    | Create/supersede a one-time pilot invite |
| GET    | `/api/businesses/[id]/services`                | Public   | List services            |
| POST   | `/api/businesses/[id]/services`                | Owner    | Create service           |
| PUT    | `/api/businesses/[id]/services/[serviceId]`    | Owner    | Update service           |
| DELETE | `/api/businesses/[id]/services/[serviceId]`    | Owner    | Delete service           |
| GET    | `/api/businesses/[id]/working-hours`           | Public   | Get working hours        |
| PUT    | `/api/businesses/[id]/working-hours`           | Owner    | Update working hours     |
| GET    | `/api/businesses/[id]/bookings`                | Owner    | List bookings (filterable) |
| PATCH  | `/api/businesses/[id]/bookings/[bookingId]`    | Owner    | Update booking status    |
| GET    | `/api/businesses/[id]/customers`               | Owner    | List customers           |
| GET    | `/api/businesses/[id]/slots`                   | Public   | Get available time slots |
| GET    | `/api/bookings/business?slug=...`              | Public   | Resolve business by slug |
| POST   | `/api/bookings`                                | Public   | Create a booking         |

## Deployment

Build for production:

```bash
npm run build
npm start
```

Recommended platforms: Vercel, Railway, or any Node.js hosting with PostgreSQL.

Set all environment variables on your hosting platform before deploying.
