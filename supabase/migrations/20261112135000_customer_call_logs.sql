-- Migration: Customer Call Logs (Sales Call Tracking + Caller ID Sync)
-- Purpose: Store customer call activity logged automatically from Android CallLog (matched
--          against central customer_contacts) or logged via in-app dial / manual quick notes.

CREATE TABLE IF NOT EXISTS public.customer_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  phone_normalized TEXT NOT NULL CHECK (char_length(trim(phone_normalized)) > 0),
  phone_display TEXT NOT NULL DEFAULT '',
  contact_name_snapshot TEXT NOT NULL DEFAULT '',
  company_name_snapshot TEXT NOT NULL DEFAULT '',
  contact_category_snapshot TEXT NOT NULL DEFAULT 'general',
  call_direction TEXT NOT NULL CHECK (call_direction IN ('incoming', 'outgoing', 'missed')),
  call_source TEXT NOT NULL DEFAULT 'manual' CHECK (call_source IN ('android_call_log', 'in_app_dial', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_sec INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
  outcome TEXT NOT NULL DEFAULT 'connected' CHECK (outcome IN ('connected', 'no_answer', 'busy', 'follow_up', 'unknown')),
  note TEXT NOT NULL DEFAULT '',
  device_call_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_call_logs_user_device_key UNIQUE (user_id, device_call_key)
);

COMMENT ON TABLE public.customer_call_logs IS 'Customer call logs synced from Android CallLog (matched to customer_contacts) or recorded via in-app dial and quick call notes.';

CREATE INDEX IF NOT EXISTS idx_customer_call_logs_user_started
  ON public.customer_call_logs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_call_logs_contact_started
  ON public.customer_call_logs (contact_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_call_logs_phone_started
  ON public.customer_call_logs (phone_normalized, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_call_logs_started_at
  ON public.customer_call_logs (started_at DESC);

CREATE OR REPLACE FUNCTION public.set_customer_call_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_call_logs_updated_at ON public.customer_call_logs;
CREATE TRIGGER trg_customer_call_logs_updated_at
  BEFORE UPDATE ON public.customer_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_call_logs_updated_at();

ALTER TABLE public.customer_call_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_call_logs FROM anon;
REVOKE ALL ON TABLE public.customer_call_logs FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_call_logs TO authenticated;
GRANT ALL ON TABLE public.customer_call_logs TO service_role;

DROP POLICY IF EXISTS customer_call_logs_select_authenticated ON public.customer_call_logs;
CREATE POLICY customer_call_logs_select_authenticated
  ON public.customer_call_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_call_logs_insert_own ON public.customer_call_logs;
CREATE POLICY customer_call_logs_insert_own
  ON public.customer_call_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS customer_call_logs_update_own ON public.customer_call_logs;
CREATE POLICY customer_call_logs_update_own
  ON public.customer_call_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS customer_call_logs_delete_admin ON public.customer_call_logs;
CREATE POLICY customer_call_logs_delete_admin
  ON public.customer_call_logs
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
