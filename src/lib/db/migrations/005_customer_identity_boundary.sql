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
