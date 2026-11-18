-- Add last_update column to pi_records (matches CSV Column R "Last Update")
ALTER TABLE public.pi_records
ADD COLUMN IF NOT EXISTS last_update TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
