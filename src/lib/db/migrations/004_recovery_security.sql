-- ═══════════════════════════════════════════════════════
-- Migration 004: Recovery reconciliation and hardening
-- Forward-only changes validated against the recovered 2026-08-11 backup.
-- ═══════════════════════════════════════════════════════

SET LOCAL search_path TO public, extensions;

-- Make business lifecycle values explicit before they are used for auth.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'businesses_status_check'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_status_check
      CHECK (status IN ('pending', 'active', 'suspended')) NOT VALID;
    ALTER TABLE public.businesses VALIDATE CONSTRAINT businesses_status_check;
  END IF;
END $$;

-- The recovered Supabase project stores uuid-ossp in `extensions`, while the
-- legacy overlap trigger resolved both the table and uuid_generate_v4() through
-- the caller's search path. Remove that dependency and pin a safe path.
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.staff_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.staff_id = NEW.staff_id
        AND booking.date = NEW.date
        AND booking.status NOT IN ('Cancelled', 'No-Show')
        AND booking.id IS DISTINCT FROM NEW.id
        AND (NEW.time, NEW.end_time) OVERLAPS (booking.time, booking.end_time)
    ) THEN
      RAISE EXCEPTION 'Booking overlaps with an existing appointment for this staff member';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.bookings AS booking
      WHERE booking.business_id = NEW.business_id
        AND booking.date = NEW.date
        AND booking.staff_id IS NULL
        AND booking.status NOT IN ('Cancelled', 'No-Show')
        AND booking.id IS DISTINCT FROM NEW.id
        AND (NEW.time, NEW.end_time) OVERLAPS (booking.time, booking.end_time)
    ) THEN
      RAISE EXCEPTION 'Booking overlaps with an existing appointment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Preserve historical commercial facts even when a service changes later.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_name_snapshot VARCHAR(255),
  ADD COLUMN IF NOT EXISTS service_price_snapshot NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_price NUMERIC(10, 2);

-- Keep the migration deployable before every legacy application instance has
-- drained. The trigger only handles the exact old INSERT shape: all snapshot
-- fields omitted and the default zero discount. Explicit new-writer values are
-- never rewritten.
CREATE OR REPLACE FUNCTION public.fill_legacy_booking_price_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  authoritative_service_name public.services.name%TYPE;
  authoritative_service_price public.services.price%TYPE;
  authoritative_discount_type public.promotions.discount_type%TYPE;
  authoritative_discount_value public.promotions.discount_value%TYPE;
BEGIN
  IF NEW.service_name_snapshot IS NOT NULL
    OR NEW.service_price_snapshot IS NOT NULL
    OR NEW.final_price IS NOT NULL
    OR NEW.discount_amount IS DISTINCT FROM 0
  THEN
    RETURN NEW;
  END IF;

  SELECT service.name, service.price
  INTO authoritative_service_name, authoritative_service_price
  FROM public.services AS service
  WHERE service.id = NEW.service_id
    AND service.business_id = NEW.business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking service does not belong to the selected business'
      USING ERRCODE = '23503';
  END IF;

  NEW.service_name_snapshot := authoritative_service_name;
  NEW.service_price_snapshot := authoritative_service_price;
  NEW.discount_amount := 0;

  IF NEW.promotion_id IS NOT NULL THEN
    SELECT promotion.discount_type, promotion.discount_value
    INTO authoritative_discount_type, authoritative_discount_value
    FROM public.promotions AS promotion
    WHERE promotion.id = NEW.promotion_id
      AND promotion.business_id = NEW.business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking promotion does not belong to the selected business'
        USING ERRCODE = '23503';
    END IF;

    IF authoritative_discount_type = 'percentage' THEN
      NEW.discount_amount := LEAST(
        ROUND(
          authoritative_service_price * authoritative_discount_value / 100,
          2
        ),
        authoritative_service_price
      );
    ELSIF authoritative_discount_type = 'fixed' THEN
      NEW.discount_amount := LEAST(
        authoritative_discount_value,
        authoritative_service_price
      );
    ELSE
      RAISE EXCEPTION 'Booking promotion has an unsupported discount type'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.final_price := authoritative_service_price - NEW.discount_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_legacy_booking_price_snapshot
  ON public.bookings;
CREATE TRIGGER trg_fill_legacy_booking_price_snapshot
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  WHEN (
    NEW.service_name_snapshot IS NULL
    AND NEW.service_price_snapshot IS NULL
    AND NEW.final_price IS NULL
    AND NEW.discount_amount = 0
  )
  EXECUTE FUNCTION public.fill_legacy_booking_price_snapshot();

-- Promotion limits must be internally coherent before booking prices rely on
-- them. Add without a table scan first, then validate recovered rows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'promotions_valid_date_range_check'
      AND conrelid = 'public.promotions'::regclass
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_valid_date_range_check
      CHECK (valid_from <= valid_to) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'promotions_max_uses_check'
      AND conrelid = 'public.promotions'::regclass
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_max_uses_check
      CHECK (max_uses IS NULL OR max_uses > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'promotions_current_uses_check'
      AND conrelid = 'public.promotions'::regclass
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_current_uses_check
      CHECK (
        current_uses >= 0
        AND (max_uses IS NULL OR current_uses <= max_uses)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'promotions_percentage_discount_check'
      AND conrelid = 'public.promotions'::regclass
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_percentage_discount_check
      CHECK (discount_type <> 'percentage' OR discount_value <= 100) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.promotions
  VALIDATE CONSTRAINT promotions_valid_date_range_check;
ALTER TABLE public.promotions
  VALIDATE CONSTRAINT promotions_max_uses_check;
ALTER TABLE public.promotions
  VALIDATE CONSTRAINT promotions_current_uses_check;
ALTER TABLE public.promotions
  VALIDATE CONSTRAINT promotions_percentage_discount_check;

UPDATE public.bookings AS booking
SET service_name_snapshot = COALESCE(booking.service_name_snapshot, service.name),
    service_price_snapshot = COALESCE(booking.service_price_snapshot, service.price),
    discount_amount = COALESCE(booking.discount_amount, 0),
    final_price = COALESCE(
      booking.final_price,
      service.price - COALESCE(booking.discount_amount, 0)
    )
FROM public.services AS service
WHERE service.id = booking.service_id
  AND (
    booking.service_name_snapshot IS NULL
    OR booking.service_price_snapshot IS NULL
    OR booking.discount_amount IS NULL
    OR booking.final_price IS NULL
  );

ALTER TABLE public.bookings
  ALTER COLUMN service_name_snapshot SET NOT NULL,
  ALTER COLUMN service_price_snapshot SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN final_price SET NOT NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_price_snapshot_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_price_snapshot_check
  CHECK (
    service_price_snapshot >= 0
    AND discount_amount >= 0
    AND discount_amount <= service_price_snapshot
    AND final_price >= 0
    AND final_price = service_price_snapshot - discount_amount
  ) NOT VALID;
ALTER TABLE public.bookings
  VALIDATE CONSTRAINT bookings_price_snapshot_check;

-- Service removal must never cascade through appointment history.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_service_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;

-- Database-level last line of defence against simultaneous exact overlaps.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_staff_active_slot_excl'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_staff_active_slot_excl
      EXCLUDE USING gist (
        staff_id WITH =,
        tsrange(date + time, date + end_time, '[)') WITH &&
      )
      WHERE (staff_id IS NOT NULL AND status = 'Booked');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_business_active_slot_excl'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_business_active_slot_excl
      EXCLUDE USING gist (
        business_id WITH =,
        tsrange(date + time, date + end_time, '[)') WITH &&
      )
      WHERE (staff_id IS NULL AND status = 'Booked');
  END IF;
END $$;

-- Cover foreign keys and common tenant/date lookups.
CREATE INDEX IF NOT EXISTS idx_bookings_service ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff ON public.bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_promotion ON public.bookings(promotion_id);
CREATE INDEX IF NOT EXISTS idx_bookings_active_staff_date
  ON public.bookings(staff_id, date, time)
  WHERE status = 'Booked' AND staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_dates_staff ON public.blocked_dates(staff_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON public.customer_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_booking ON public.notification_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON public.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_staff ON public.reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service ON public.staff_services(service_id);

-- The application reaches PostgreSQL only from server-side routes as postgres.
-- Keep PostgREST's anon/authenticated roles away from these private tables.
DO $$
DECLARE
  app_table TEXT;
  api_role TEXT;
  app_tables CONSTANT TEXT[] := ARRAY[
    'admins', 'blocked_dates', 'bookings', 'businesses', 'client_notes',
    'client_tags', 'customer_tags', 'customers', 'notification_logs',
    'promotions', 'reviews', 'schema_migrations', 'services', 'staff',
    'staff_services'
  ];
BEGIN
  FOREACH app_table IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
  END LOOP;

  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      FOREACH app_table IN ARRAY app_tables LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', app_table, api_role);
      END LOOP;
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_booking_overlap() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_legacy_booking_price_snapshot() FROM PUBLIC;
