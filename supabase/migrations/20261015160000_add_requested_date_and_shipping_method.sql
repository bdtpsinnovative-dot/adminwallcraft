-- Add requested_date and shipping_method to pi_records
ALTER TABLE public.pi_records 
ADD COLUMN IF NOT EXISTS requested_date TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
