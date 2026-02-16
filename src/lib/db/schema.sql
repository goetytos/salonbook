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

CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_email ON businesses(email);

-- ─── Services ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  price            DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_business ON services(business_id);

-- ─── Customers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, phone)
);

CREATE INDEX idx_customers_phone ON customers(phone);

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

CREATE INDEX idx_bookings_business ON bookings(business_id);
CREATE INDEX idx_bookings_date ON bookings(business_id, date);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Prevent overlapping bookings for the same business on the same date.
-- Uses an exclusion constraint with time ranges: a new booking's [time, end_time)
-- must not overlap with any existing non-cancelled booking.
-- Note: requires btree_gist extension for combining equality and range exclusion.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Function-based approach for overlap prevention (works without exclusion constraint)
-- The application layer also enforces this via SELECT FOR UPDATE.
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

CREATE TRIGGER trg_check_booking_overlap
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();
