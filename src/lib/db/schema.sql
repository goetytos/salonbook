-- ═══════════════════════════════════════════════════════
-- SalonBook Database Schema (Reference)
-- PostgreSQL 14+
-- This file documents the full schema after all migrations.
-- Actual migrations are in ./migrations/
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── Businesses ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) NOT NULL UNIQUE,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  location          VARCHAR(500) NOT NULL,
  working_hours     JSONB NOT NULL DEFAULT '{}'::jsonb,
  description       TEXT,
  cover_image_url   VARCHAR(500),
  avatar_url        VARCHAR(500),
  category          VARCHAR(100),
  social_links      JSONB DEFAULT '{}',
  cancellation_hours INT DEFAULT 24,
  deposit_required  BOOLEAN DEFAULT false,
  buffer_minutes    INT DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Services ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  price            DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  description      TEXT,
  buffer_minutes   INT DEFAULT 0,
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Customers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, phone)
);

-- ─── Staff ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  phone          VARCHAR(20),
  role           VARCHAR(50) NOT NULL DEFAULT 'stylist',
  specialties    JSONB DEFAULT '[]',
  avatar_url     VARCHAR(500),
  working_hours  JSONB NOT NULL DEFAULT '{}'::jsonb,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Staff ↔ Services ────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_services (
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

-- ─── Bookings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id      UUID REFERENCES staff(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  time          TIME NOT NULL,
  end_time      TIME NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'Booked'
                CHECK (status IN ('Booked', 'Cancelled', 'Completed', 'No-Show')),
  no_show       BOOLEAN DEFAULT false,
  notes         TEXT,
  promotion_id  UUID REFERENCES promotions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Reviews ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id  UUID UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
  staff_id    UUID REFERENCES staff(id) ON DELETE SET NULL,
  rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Client Notes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Client Tags ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_tags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  UNIQUE(business_id, name)
);

-- ─── Customer ↔ Tags ─────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

-- ─── Blocked Dates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_dates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id    UUID REFERENCES staff(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  reason      VARCHAR(255)
);

-- ─── Notification Logs ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        VARCHAR(50) NOT NULL,
  recipient   VARCHAR(255) NOT NULL,
  channel     VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  payload     JSONB DEFAULT '{}',
  error_msg   TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Promotions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code                VARCHAR(50) NOT NULL,
  discount_type       VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value      DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  valid_from          DATE NOT NULL,
  valid_to            DATE NOT NULL,
  max_uses            INT,
  current_uses        INT NOT NULL DEFAULT 0,
  applicable_services UUID[] DEFAULT '{}',
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, code)
);

-- ─── Schema Migrations (tracking) ────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
