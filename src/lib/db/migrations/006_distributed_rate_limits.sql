-- ═══════════════════════════════════════════════════════
-- Migration 006: Privacy-preserving distributed rate limits
-- ═══════════════════════════════════════════════════════

SET LOCAL search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.rate_limit_windows (
  scope VARCHAR(64) NOT NULL,
  identifier_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT rate_limit_windows_pkey
    PRIMARY KEY (scope, identifier_hash, window_started_at),
  CONSTRAINT rate_limit_windows_scope_check
    CHECK (scope ~ '^[a-z0-9][a-z0-9_.:-]{0,63}$'),
  CONSTRAINT rate_limit_windows_identifier_hash_check
    CHECK (identifier_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT rate_limit_windows_request_count_check
    CHECK (request_count > 0),
  CONSTRAINT rate_limit_windows_expiry_check
    CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_windows_expiry
  ON public.rate_limit_windows (expires_at);

ALTER TABLE public.rate_limit_windows ENABLE ROW LEVEL SECURITY;

-- The server-side application connection owns this private table. Never expose
-- limiter identifiers or counters through PostgREST roles.
REVOKE ALL ON TABLE public.rate_limit_windows FROM PUBLIC;

DO $$
DECLARE
  api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.rate_limit_windows FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.rate_limit_windows IS
  'Short-lived fixed-window counters keyed only by server-side HMAC digests; never stores raw IP, email, or phone values.';
