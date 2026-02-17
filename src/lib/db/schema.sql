-- ═══════════════════════════════════════════════════════
-- SalonBook Database Schema
-- PostgreSQL 14+
-- ═══════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Businesses ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  location    VARCHAR(500) NOT NULL,
  working_hours JSONB NOT NULL DEFAULT '{
    "monday":    {"open": "09:00", "close": "18:00", "closed": false},
    "tuesday":   {"open": "09:00", "close": "18:00", "closed": false},
    "wednesday": {"open": "09:00", "close": "18:00", "closed": false},
    "thursday":  {"open": "09:00", "close": "18:00", "closed": false},
    "friday":    {"open": "09:00", "close": "18:00", "closed": false},
    "saturday":  {"open": "09:00", "close": "14:00", "closed": false},
    "sunday":    {"open": "00:00", "close": "00:00", "closed": true}
  }'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);

-- ─── Services ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  price            DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);

-- ─── Customers (supports optional account login) ─────
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- ─── Bookings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  time        TIME NOT NULL,
  end_time    TIME NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'Cancelled', 'Completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(business_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Prevent overlapping bookings for the same business on the same date.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE business_id = NEW.business_id
      AND date = NEW.date
      AND status != 'Cancelled'
      AND id != COALESCE(NEW.id, uuid_generate_v4())
      AND (NEW.time, NEW.end_time) OVERLAPS (time, end_time)
  ) THEN
    RAISE EXCEPTION 'Booking overlaps with an existing appointment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_booking_overlap ON bookings;
CREATE TRIGGER trg_check_booking_overlap
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();
