# SalonBook – Appointment & Booking Platform

Professional appointment booking platform for salons and barber shops in Kenya. Business owners manage their services, working hours, and bookings. Customers book appointments online — no account required.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL
- **Auth:** JWT with bcrypt password hashing

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
│   ├── modules/              # Future integrations (stub)
│   │   ├── sms/              # Africa's Talking SMS
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

## User Flows

### Business Owner

1. Sign up at `/auth/signup`
2. Add services from the dashboard
3. Configure working hours in Settings
4. Share the booking link: `/book/[your-slug]`
5. View and manage bookings from the dashboard

### Customer (No Account Required)

1. Visit the booking link: `/book/[business-slug]`
2. Select a service
3. Pick a date and available time slot
4. Enter name and phone number
5. Confirm booking

## API Routes

| Method | Route                                          | Auth     | Description              |
| ------ | ---------------------------------------------- | -------- | ------------------------ |
| POST   | `/api/auth/signup`                             | Public   | Register business        |
| POST   | `/api/auth/login`                              | Public   | Login                    |
| GET    | `/api/auth/me`                                 | Required | Get profile + stats      |
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
