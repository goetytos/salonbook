-- ═══════════════════════════════════════════════════════
-- Migration 002: Booksy-Style Upgrade
-- Adds staff, reviews, CRM, promotions, notifications,
-- business profiles, blocked dates, and enhanced booking.
-- All statements are idempotent (safe to re-run).
-- ═══════════════════════════════════════════════════════

-- ─── Extend businesses table ────────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cancellation_hours INT DEFAULT 24;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0;

-- ─── Extend services table ──────────────────────────────
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS buffer_minutes INT DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ─── Extend bookings table ──────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promotion_id UUID;

-- Update status CHECK to include 'No-Show'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('Booked', 'Cancelled', 'Completed', 'No-Show'));

-- ─── Staff table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  phone          VARCHAR(20),
  role           VARCHAR(50) NOT NULL DEFAULT 'stylist',
  specialties    JSONB DEFAULT '[]',
  avatar_url     VARCHAR(500),
  working_hours  JSONB NOT NULL DEFAULT '{
    "monday":    {"open": "09:00", "close": "18:00", "closed": false},
    "tuesday":   {"open": "09:00", "close": "18:00", "closed": false},
    "wednesday": {"open": "09:00", "close": "18:00", "closed": false},
    "thursday":  {"open": "09:00", "close": "18:00", "closed": false},
    "friday":    {"open": "09:00", "close": "18:00", "closed": false},
    "saturday":  {"open": "09:00", "close": "14:00", "closed": false},
    "sunday":    {"open": "00:00", "close": "00:00", "closed": true}
  }'::jsonb,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_business ON staff(business_id);

-- ─── Staff ↔ Services junction ──────────────────────────
CREATE TABLE IF NOT EXISTS staff_services (
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

-- FK from bookings.staff_id → staff
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bookings_staff_id_fkey'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_staff_id_fkey
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Reviews ────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);

-- ─── Client Notes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_customer ON client_notes(business_id, customer_id);

-- ─── Client Tags ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_tags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  UNIQUE(business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_tags_business ON client_tags(business_id);

-- ─── Customer ↔ Tags junction ───────────────────────────
CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

-- ─── Blocked Dates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_dates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id    UUID REFERENCES staff(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  reason      VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_business ON blocked_dates(business_id, date);

-- ─── Notification Logs ──────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_notification_logs_business ON notification_logs(business_id);

-- ─── Promotions ─────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_promotions_business ON promotions(business_id);

-- FK from bookings.promotion_id → promotions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bookings_promotion_id_fkey'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_promotion_id_fkey
      FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Update overlap trigger to be staff-aware ───────────
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- When staff_id is set, check per-staff overlap
  IF NEW.staff_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE staff_id = NEW.staff_id
        AND date = NEW.date
        AND status NOT IN ('Cancelled', 'No-Show')
        AND id != COALESCE(NEW.id, uuid_generate_v4())
        AND (NEW.time, NEW.end_time) OVERLAPS (time, end_time)
    ) THEN
      RAISE EXCEPTION 'Booking overlaps with an existing appointment for this staff member';
    END IF;
  ELSE
    -- No staff: check per-business (original behavior)
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE business_id = NEW.business_id
        AND date = NEW.date
        AND staff_id IS NULL
        AND status NOT IN ('Cancelled', 'No-Show')
        AND id != COALESCE(NEW.id, uuid_generate_v4())
        AND (NEW.time, NEW.end_time) OVERLAPS (time, end_time)
    ) THEN
      RAISE EXCEPTION 'Booking overlaps with an existing appointment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
