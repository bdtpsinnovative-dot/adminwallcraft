-- Add amount_yuan and amount_dollar to pi_records
ALTER TABLE public.pi_records 
ADD COLUMN IF NOT EXISTS amount_yuan TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS amount_dollar TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
