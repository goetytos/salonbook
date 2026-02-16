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

- Node.js 18+
- PostgreSQL 14+

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

Required variables:

| Variable       | Description                          |
| -------------- | ------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string         |
| `JWT_SECRET`   | Secret key for JWT signing (32+ chars) |

### Database Setup

Run the migration to create tables:

```bash
npm run db:migrate
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
