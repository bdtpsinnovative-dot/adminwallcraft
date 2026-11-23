-- Add odoo_sku column to product_variants for Odoo ERP SKU mapping
-- Note: Multiple variants can share the same Odoo SKU (non-unique), indexed for lookup.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS odoo_sku TEXT;

CREATE INDEX IF NOT EXISTS idx_product_variants_odoo_sku
  ON public.product_variants (odoo_sku)
  WHERE odoo_sku IS NOT NULL;

COMMENT ON COLUMN public.product_variants.odoo_sku IS 'Odoo ERP SKU code mapped from product master sheet';

NOTIFY pgrst, 'reload schema';
