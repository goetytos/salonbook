-- ═══════════════════════════════════════════════════════
-- Migration 007: Durable booking-notification outbox
-- ═══════════════════════════════════════════════════════

SET LOCAL search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id          UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type                VARCHAR(40) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  available_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token         UUID,
  lease_expires_at    TIMESTAMPTZ,
  last_error_code     VARCHAR(64),
  provider_message_id VARCHAR(160),
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_outbox_booking_type_key UNIQUE (booking_id, type),
  CONSTRAINT notification_outbox_type_check
    CHECK (type IN (
      'booking_confirmation',
      'booking_owner_alert',
      'booking_cancellation'
    )),
  CONSTRAINT notification_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'accepted', 'dead')),
  CONSTRAINT notification_outbox_attempt_count_check
    CHECK (attempt_count >= 0 AND attempt_count <= 5),
  CONSTRAINT notification_outbox_lease_state_check CHECK (
    (status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CONSTRAINT notification_outbox_acceptance_state_check CHECK (
    (status = 'accepted' AND accepted_at IS NOT NULL AND provider_message_id IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_at IS NULL)
  )
);

-- Matches the worker's ready-job predicate and keeps terminal rows out of the
-- hot queue index.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_ready
  ON public.notification_outbox (available_at, created_at, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_outbox_expired_leases
  ON public.notification_outbox (lease_expires_at, id)
  WHERE status = 'processing';

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- Only the server-side database connection may access notification intents.
-- The rows deliberately contain no phone number, customer name, or message.
REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC;

DO $$
DECLARE
  api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.notification_outbox FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.notification_outbox IS
  'PII-minimized durable intents for booking creation and cancellation SMS. Provider acceptance is not handset delivery; a lease-expiry crash window can cause duplicate submissions.';
