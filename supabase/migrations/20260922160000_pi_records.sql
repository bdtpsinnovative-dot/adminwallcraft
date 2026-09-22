-- PI Record is edited only by Wallcraft administrators. HR Studio receives it
-- through the protected Next.js API, not directly through Supabase.
CREATE TABLE IF NOT EXISTS public.pi_records (
    id UUID PRIMARY KEY,
    pi_supplier TEXT NOT NULL DEFAULT '',
    record_date TEXT NOT NULL DEFAULT '',
    supplier TEXT NOT NULL DEFAULT '',
    link_file TEXT NOT NULL DEFAULT '',
    link_file_url TEXT NOT NULL DEFAULT '',
    etd TEXT NOT NULL DEFAULT '',
    brand TEXT NOT NULL DEFAULT '',
    order_no TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    file_url TEXT NOT NULL DEFAULT '',
    sale_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    payment_date TEXT NOT NULL DEFAULT '',
    delivered_date TEXT NOT NULL DEFAULT '',
    date_order TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pi_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wallcraft admins manage PI records" ON public.pi_records;
CREATE POLICY "Wallcraft admins manage PI records"
ON public.pi_records
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
    )
);

REVOKE ALL ON TABLE public.pi_records FROM anon;

-- New Supabase projects require explicit Data API grants for newly created
-- public tables. RLS above still restricts rows and actions to administrators.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pi_records TO authenticated;
GRANT ALL ON TABLE public.pi_records TO service_role;

-- Make the just-created table visible to PostgREST without waiting for cache TTL.
NOTIFY pgrst, 'reload schema';
