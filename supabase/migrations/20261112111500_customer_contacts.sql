-- Migration: Shared Central Customer Contacts Directory (Caller ID / Phone Book)
-- Purpose: Store normalized, reviewed, company-wide customer/project/partner phone contacts
--          extracted from orders, order_item_projects, and profiles for admin curation
--          and sales Caller ID lookup via Backend API.

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized TEXT NOT NULL UNIQUE CHECK (char_length(trim(phone_normalized)) > 0),
  phone_display TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  contact_category TEXT NOT NULL DEFAULT 'general',
  company_name TEXT NOT NULL DEFAULT '',
  project_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  alternate_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  raw_phones TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  source_tables TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  owner_sale_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_sale_name TEXT NOT NULL DEFAULT '',
  order_count INTEGER NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  last_order_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'verified', 'ignored')),
  manually_edited BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.customer_contacts IS 'Central shared directory of normalized customer, project partner, and staff contact phone numbers for admin review and sales Caller ID.';

-- Indexes for filtering, sorting, and foreign keys
CREATE INDEX IF NOT EXISTS idx_customer_contacts_review_status
  ON public.customer_contacts (review_status);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_category
  ON public.customer_contacts (contact_category);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_owner_sale_id
  ON public.customer_contacts (owner_sale_id);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_reviewed_by
  ON public.customer_contacts (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_last_order_at
  ON public.customer_contacts (last_order_at DESC NULLS LAST);

-- Maintain updated_at automatically on UPDATE
CREATE OR REPLACE FUNCTION public.set_customer_contacts_updated_at()
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

DROP TRIGGER IF EXISTS trg_customer_contacts_updated_at ON public.customer_contacts;
CREATE TRIGGER trg_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customer_contacts_updated_at();

-- Row Level Security & explicit privileges
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_contacts FROM anon;
REVOKE ALL ON TABLE public.customer_contacts FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_contacts TO authenticated;
GRANT ALL ON TABLE public.customer_contacts TO service_role;

DROP POLICY IF EXISTS customer_contacts_select_authenticated ON public.customer_contacts;
CREATE POLICY customer_contacts_select_authenticated
  ON public.customer_contacts
  FOR SELECT
  TO authenticated
  USING (
    review_status = 'verified'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_contacts_insert_admin ON public.customer_contacts;
CREATE POLICY customer_contacts_insert_admin
  ON public.customer_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_contacts_update_admin ON public.customer_contacts;
CREATE POLICY customer_contacts_update_admin
  ON public.customer_contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS customer_contacts_delete_admin ON public.customer_contacts;
CREATE POLICY customer_contacts_delete_admin
  ON public.customer_contacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
