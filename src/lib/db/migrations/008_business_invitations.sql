-- ═══════════════════════════════════════════════════════
-- Migration 008: Invitation-only business pilot onboarding
-- ═══════════════════════════════════════════════════════

SET LOCAL search_path TO public, extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.businesses
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Case-insensitive duplicate business emails must be resolved before migration 008';
  END IF;
END $$;

-- Business signup and login normalize email addresses. Enforce that identity
-- boundary at the database layer as well as in application validation.
CREATE UNIQUE INDEX IF NOT EXISTS businesses_email_normalized_uidx
  ON public.businesses (lower(btrim(email)));

CREATE TABLE IF NOT EXISTS public.business_invitations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 TEXT NOT NULL,
  token_digest          CHAR(64) NOT NULL UNIQUE,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_by_admin_id   UUID NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at            TIMESTAMPTZ,
  revoked_by_admin_id   UUID REFERENCES public.admins(id) ON DELETE RESTRICT,
  revocation_reason     TEXT,
  consumed_at           TIMESTAMPTZ,
  business_id           UUID UNIQUE REFERENCES public.businesses(id) ON DELETE RESTRICT,
  CONSTRAINT business_invitations_email_check CHECK (
    email = lower(btrim(email))
    AND length(email) BETWEEN 3 AND 255
    AND email !~ '[[:cntrl:][:space:]]'
  ),
  CONSTRAINT business_invitations_token_digest_check
    CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT business_invitations_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT business_invitations_revocation_state_check CHECK (
    (revoked_at IS NULL AND revoked_by_admin_id IS NULL AND revocation_reason IS NULL)
    OR
    (revoked_at IS NOT NULL AND revoked_by_admin_id IS NOT NULL AND revocation_reason IS NOT NULL)
  ),
  CONSTRAINT business_invitations_consumption_state_check CHECK (
    (consumed_at IS NULL AND business_id IS NULL)
    OR
    (consumed_at IS NOT NULL AND business_id IS NOT NULL)
  ),
  CONSTRAINT business_invitations_terminal_state_check CHECK (
    NOT (revoked_at IS NOT NULL AND consumed_at IS NOT NULL)
  )
);

-- There can be only one current unused invitation per normalized email.
-- Generation first revokes the previous row while holding an email-scoped
-- transaction lock, then inserts the replacement.
CREATE UNIQUE INDEX IF NOT EXISTS business_invitations_open_email_uidx
  ON public.business_invitations (email)
  WHERE revoked_at IS NULL AND consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS business_invitations_created_by_admin_idx
  ON public.business_invitations (created_by_admin_id);

CREATE INDEX IF NOT EXISTS business_invitations_revoked_by_admin_idx
  ON public.business_invitations (revoked_by_admin_id)
  WHERE revoked_by_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_invitations_expiry_idx
  ON public.business_invitations (expires_at)
  WHERE revoked_at IS NULL AND consumed_at IS NULL;

ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;

-- Invitations are capabilities managed only through authenticated server
-- routes. Raw tokens never enter this table or any PostgREST-visible surface.
REVOKE ALL ON TABLE public.business_invitations FROM PUBLIC;

DO $$
DECLARE
  api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.business_invitations FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.business_invitations IS
  'One-time business pilot invitations. Stores only SHA-256 token digests; raw invitation tokens are shown once and never persisted.';
