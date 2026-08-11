-- SalonBook production phase 2: apply migration 005 only after the new booking
-- writer is live and every legacy deployment has drained.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '5min';
SET LOCAL idle_in_transaction_session_timeout = '6min';
SET LOCAL search_path TO public, extensions;
SELECT pg_advisory_xact_lock(hashtext('salonbook:schema-migrations'));

DO $guard$
DECLARE
  duplicate_guest_groups bigint;
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'schema_migrations is missing';
  END IF;

  IF (SELECT count(*) FROM public.schema_migrations) <> 4 OR EXISTS (
    VALUES
      ('001_initial.sql', '07980427af68bf8f59f489632fc08b2569885d556d74bc322f99ab1897182e0b'),
      ('002_booksy_upgrade.sql', '071a1fa5f639d64f0b79f67df3d88b894296ce899bb7b0c85073ea5a3565ae77'),
      ('003_admin_panel.sql', '227d7315a58123fed271037415232838349cf60e61ae6922db374aae90cbcf6b'),
      ('004_recovery_security.sql', '6ba60a87b30ea05bf59525a32206aae59ca3bf355fb4c27ea48487f5da076285')
    EXCEPT
    SELECT version, checksum FROM public.schema_migrations
  ) THEN
    RAISE EXCEPTION '001-004 tracker/checksum precondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.schema_migrations
    WHERE version = '005_customer_identity_boundary.sql'
  ) THEN
    RAISE EXCEPTION '005 is already tracked; inspect before retrying';
  END IF;

  IF to_regclass('public.customers_guest_name_phone_uidx') IS NOT NULL THEN
    RAISE EXCEPTION '005 partial index exists but is untracked';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_name_phone_key'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'Expected legacy customers_name_phone_key is missing';
  END IF;

  SELECT count(*) INTO duplicate_guest_groups
  FROM (
    SELECT 1
    FROM public.customers
    WHERE email IS NULL AND password_hash IS NULL
    GROUP BY name, phone
    HAVING count(*) > 1
  ) duplicate_groups;

  IF duplicate_guest_groups <> 0 THEN
    RAISE EXCEPTION '% duplicate guest identity groups block 005', duplicate_guest_groups;
  END IF;
END
$guard$;

-- BEGIN EXACT 005 BODY
-- ═══════════════════════════════════════════════════════
-- Migration 005: Separate guest booking identity from customer accounts
-- ═══════════════════════════════════════════════════════

SET LOCAL search_path TO public, extensions;

-- The original constraint treated a matching name and phone number as a
-- globally unique identity. Those attributes are not proof that an account
-- owner owns an earlier guest booking, and the constraint also prevented a
-- legitimate account from being created beside an existing guest row.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_name_phone_key;

-- Keep anonymous booking retries/concurrency idempotent without constraining
-- credentialed accounts. Current guest rows are created without either field.
CREATE UNIQUE INDEX IF NOT EXISTS customers_guest_name_phone_uidx
  ON public.customers (name, phone)
  WHERE email IS NULL AND password_hash IS NULL;

COMMENT ON INDEX public.customers_guest_name_phone_uidx IS
  'Deduplicates passwordless booking guests only. Name and phone are not account ownership proof.';

-- FUTURE: linking a guest row (and its bookings) to an account requires a
-- verified phone OTP flow and an explicit, audited transactional merge. Never
-- transfer bookings based only on matching name and/or phone text.
-- END EXACT 005 BODY

INSERT INTO public.schema_migrations (version, checksum)
VALUES (
  '005_customer_identity_boundary.sql',
  '026625ecd449ace7806265eaaf69a4a08738707662de671d0fded8ad179172d1'
);

COMMIT;
