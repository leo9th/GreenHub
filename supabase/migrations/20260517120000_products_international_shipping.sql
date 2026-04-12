-- International shipping destinations (preset ids, e.g. usa, uk) and per-destination fee + ETA JSON.
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_destinations TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS international_shipping_fees JSONB;

COMMENT ON COLUMN products.shipping_destinations IS 'Selected international shipping preset ids (e.g. usa, uk, canada).';
COMMENT ON COLUMN products.international_shipping_fees IS 'Per preset: { "usa": { "fee": number, "duration": "7-14 days" }, ... }.';
